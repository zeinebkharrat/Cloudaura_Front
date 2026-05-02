import argparse
import csv
import json
import os
import re
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

class LoginRiskAnalyzer:
    """
    Module d'IA local pour analyser les risques liés aux tentatives de connexion.
    S'entraîne désormais sur un dataset massif de 50 000 entrées.
    """
    
    def __init__(self, dataset_path=None, verbose=True):
        self.verbose = verbose
        self.dataset_path = dataset_path or str(Path(__file__).with_name("dataset_login_50k.csv"))
        self.model = self._train_model()

    def _train_model(self):
        """Entraîne le modèle ML avec le dataset CSV externe."""
        if not os.path.exists(self.dataset_path):
            if self.verbose:
                print(f"Dataset non trouve a {self.dataset_path}. Utilisation d'un mini-dataset de secours.")
            X = ["admin", "john_doe", "' OR 1=1 --", "<script>alert(1)</script>"]
            y = [0, 0, 1, 1]
        else:
            if self.verbose:
                print(f"Chargement du dataset : {self.dataset_path}...")
            X = []
            y = []
            with open(self.dataset_path, "r", encoding="utf-8", newline="") as csv_file:
                reader = csv.DictReader(csv_file)
                for row in reader:
                    text = (row.get("text") or "").strip()
                    label = (row.get("label") or "").strip()
                    if not text or label == "":
                        continue
                    X.append(text)
                    y.append(int(label))
                    if len(X) >= 10000:
                        break
            if self.verbose:
                print(f"Dataset charge ({len(X)} lignes). Entrainement en cours...")
        
        # Pipeline optimisé pour la performance avec 50k lignes
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(analyzer='char', ngram_range=(1, 4), max_features=10000)),
            ('classifier', LogisticRegression(class_weight='balanced', random_state=42, solver='liblinear'))
        ])
        
        pipeline.fit(X, y)
        if self.verbose:
            print("Modele entraine et pret !")
        return pipeline

    def _extract_heuristics(self, text, is_password=False):
        """Analyse heuristique avec expressions régulières étendue."""
        patterns = {
            "SQLi": r"(?i)(?:\bunion\b\s+\bselect\b|\bselect\b.*\bfrom\b|\bdrop\b\s+\btable\b|\binsert\b\s+\binto\b|\bupdate\b\s+\w+\s+\bset\b|\bdelete\b\s+\bfrom\b|(?:\bor\b|\band\b)\s+['\"]?\w+['\"]?\s*=\s*['\"]?\w+['\"]?|xp_cmdshell|exec|sp_)",
            "SQLi_Chars": r"(--|#|/\*|\*/)",
            "XSS": r'(?i)(<script|javascript:|onerror=|onload=|<img|<iframe|<svg|confirm\(|alert\(|eval\(|prompt\()',
            "Command Injection": r'(?i)(\|\||&&|`|\$\(|<|>)',
            "Command Injection_Chars": r'(;|\|)',
            "Path Traversal": r'(\.\.[/\\]|/etc/|/var/|C:\\|Windows\\)',
            "NoSQLi": r'(\$gt|\$ne|\$eq|\$where|\$regex)',
            "Protocol/URL": r'(http://|https://|ftp://|file://|php://|data:)',
            "Sensitive Files": r'(\.passwd|\.shadow|\.htpasswd|\.config|\.ini|\.env|\.git|\.bak|\.sql|\.old|\.log|\.db|\.yaml|\.json|\.yml)'
        }
        
        risk_score = 0.0
        details = []
        
        for name, pattern in patterns.items():
            if re.search(pattern, text):
                if "_Chars" in name:
                    # Caractères spéciaux autorisés plus souvent dans les mots de passe
                    weight = 0.1 if is_password else 0.25
                else:
                    weight = 0.4
                
                # Réduction drastique du risque pour les mots de passe sur certains patterns
                if is_password and name in ["Protocol/URL", "Sensitive Files", "Command Injection"]:
                    weight *= 0.5
                
                risk_score += weight
                details.append(name.replace("_Chars", ""))
        
        # Détection de caractères de contrôle ou encodages suspects
        if re.search(r"[\x00-\x1F\x7F]", text) or "%00" in text:
            risk_score += 0.3
            details.append("Caractères de contrôle/Null-byte")
            
        return min(1.0, risk_score), details

    def analyze(self, username, password, telemetry=None):
        """
        Évalue si la tentative de connexion est suspecte en combinant le contenu et la télémétrie.
        """
        # 1. Analyse du contenu (ML + Heuristiques)
        user_prob = self.model.predict_proba([username])[0][1]
        pass_prob = self.model.predict_proba([password])[0][1]
        
        user_heur, user_types = self._extract_heuristics(username, is_password=False)
        pass_heur, pass_types = self._extract_heuristics(password, is_password=True)
        
        content_risk = max(
            min(1.0, (user_prob * 0.4) + user_heur),
            min(1.0, (pass_prob * 0.3) + pass_heur)
        )
        
        # 2. Analyse de la télémétrie (Confiance Adaptative)
        telemetry_risk = 0.0
        telemetry_details = []
        
        if telemetry:
            ks = telemetry.get("keystroke", {})
            behavior = telemetry.get("behavior", {})
            
            avg_timing = ks.get("avg", 0)
            std_timing = ks.get("std", 0)
            is_pasted = behavior.get("pasted", False)
            
            if is_pasted:
                telemetry_details.append("Copier-coller détecté (Humain)")
            else:
                if avg_timing == 0:
                    telemetry_risk += 0.5
                    telemetry_details.append("Injection instantanée (Bot Script)")
                elif 0 < avg_timing < 60: 
                    # Analyse de la régularité
                    if std_timing < 6: # Très régulier (Bot)
                        telemetry_risk += 0.45
                        telemetry_details.append(f"Saisie robotique détectée (Régularité suspecte: {std_timing:.1f}ms)")
                    elif std_timing > 20: # Très irrégulier (Humain rapide)
                        telemetry_risk += 0.05
                        telemetry_details.append(f"Humain rapide validé (Variabilité: {std_timing:.1f}ms)")
                    else:
                        telemetry_risk += 0.2
                        telemetry_details.append("Saisie rapide (Suspicion faible)")
            
            # Mouse Dynamics (gardé pour l'exemple futur)
            mouse = telemetry.get("mouse", {})
            linearity = mouse.get("linearity", 1.0)
            if linearity > 0.98 and mouse.get("velocity", 0) > 0:
                telemetry_risk += 0.3
                telemetry_details.append("Trajectoire souris rectiligne")

        # Score final (60% contenu, 40% comportement)
        final_risk = (content_risk * 0.6) + (min(1.0, telemetry_risk) * 0.4)
        all_detected_types = list(set(user_types + pass_types + telemetry_details))
        
        is_blocked = final_risk >= 0.45
        
        message_details = []
        if is_blocked or final_risk > 0.1:
            message_details.append(f"Score Risque : {int(final_risk * 100)}/100")
            if all_detected_types:
                message_details.append(f"Signaux : {', '.join(all_detected_types)}")
            
        return {
            "is_blocked": bool(is_blocked),
            "risk_score": round(final_risk, 2),
            "details": message_details,
            "message": "ACCES BLOQUE" if is_blocked else "ACCES AUTORISE"
        }

# Exemple d'utilisation rapide si le script est exécuté directement
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Login risk analyzer")
    parser.add_argument("--username", default="")
    parser.add_argument("--password", default="")
    parser.add_argument("--json", action="store_true", help="Emit JSON only")
    args = parser.parse_args()

    if args.username or args.password:
        analyzer = LoginRiskAnalyzer(verbose=False)
        result = analyzer.analyze(args.username, args.password, None)
        payload = {
            "status": "blocked" if result["is_blocked"] else "allowed",
            "trusted": not result["is_blocked"],
            "riskScore": result["risk_score"],
            "details": result["details"],
            "message": result["message"],
        }
        # Force UTF-8 output for Windows compatibility when redirected
        import sys
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        print(json.dumps(payload, ensure_ascii=True))
    else:
        analyzer = LoginRiskAnalyzer()
        print("Test Sain:", analyzer.analyze("admin", "motdepasse123"))
        print("Test Malveillant:", analyzer.analyze("' OR 1=1 --", "pwd"))
