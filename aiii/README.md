# AI Login Security Shield 🛡️

Ce sous-projet est un module d'Intelligence Artificielle local conçu pour sécuriser le processus d'authentification. Il détecte les anomalies de saisie (Injections SQL, attaques XSS, etc.) sans faire appel à une API externe.

## Fonctionnalités
- **Machine Learning embarqué** : Utilise `scikit-learn` (TF-IDF + Régression Logistique) pour analyser la syntaxe des entrées.
- **Analyse Heuristique** : Expressions régulières pour détecter instantanément les motifs d'attaque connus.
- **Modulaire** : Le fichier `security_analyzer.py` contient une classe autonome `LoginRiskAnalyzer` qui pourra être invoquée ultérieurement par un contrôleur Spring Boot via un script Python ou un micro-service local (ex: Flask/FastAPI).
- **Interface de Test** : `gradio_app.py` simule un formulaire de login pour valider le comportement de l'IA en temps réel.

## Installation

1. Assurez-vous d'avoir Python 3.8+ installé.
2. Créez un environnement virtuel (optionnel mais recommandé) :
   ```bash
   python -m venv venv
   # Activation sur Windows :
   venv\Scripts\activate
   ```
3. Installez les dépendances :
   ```bash
   pip install -r requirements.txt
   ```

## Utilisation de l'interface de test (Gradio)

Lancez l'interface utilisateur pour tester le modèle :
```bash
python gradio_app.py
```
L'interface sera accessible dans votre navigateur à l'adresse http://127.0.0.1:7860.

## Intégration future avec Spring Boot

Pour être appelé par le backend Java (Spring Boot) :
1. Vous pourrez exposer la méthode `analyzer.analyze(username, password)` via une petite API Flask/FastAPI locale.
2. Ou bien utiliser `Jython` / un script exécutable appelé directement par le processus Java qui lit les arguments d'entrée et retourne le JSON d'évaluation.
