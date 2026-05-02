import gradio as gr
import json
from security_analyzer import LoginRiskAnalyzer

print("--- Initialisation du modèle... ---")
analyzer = LoginRiskAnalyzer()
print("--- Modèle prêt ! ---")

def process_login(username, password, is_bot, telemetry_data):
    print(f"--- Action détectée pour : '{username}' ---")
    try:
        # Analyse des signaux
        tel = {}
        if telemetry_data:
            tel = json.loads(telemetry_data)
            print(f"Télémétrie reçue: {tel}")
        else:
            print("Aucune télémétrie reçue.")

        result = analyzer.analyze(username, password, tel)
        
        risk = int(result["risk_score"] * 100)
        status = f"{result['message']}\nConfiance : {100-risk}%\nRisque : {risk}/100"
        details = "\n".join(result["details"]) if result["details"] else "Comportement humain normal."
        
        print(f"--- Résultat : {risk}% ---")
        return status, details
    except Exception as e:
        import traceback
        print(f"!!! Erreur: {e}")
        traceback.print_exc()
        return f"Erreur backend: {e}", ""

with gr.Blocks(title="Zero Trust AI") as demo:
    gr.Markdown("# 🛡️ Zero Trust AI Login\nCe système analyse **ce que** vous tapez et **comment** vous le tapez.")
    
    with gr.Row():
        with gr.Column():
            user_input = gr.Textbox(label="Utilisateur", elem_id="username_input")
            pwd_input = gr.Textbox(label="Mot de passe", type="password", elem_id="password_input")
            # Ajout d'une case à cocher pour simuler un bot facilement
            bot_sim = gr.Checkbox(label="🤖 Simuler une attaque de Bot (Saisie instantanée)", value=False)
            btn = gr.Button("Vérifier la Confiance", variant="primary", elem_id="login_btn")
        
        with gr.Column():
            out_status = gr.Textbox(label="Statut", interactive=False)
            out_details = gr.Textbox(label="Détails du comportement", interactive=False)

    tel_state = gr.Textbox(visible=False)

    # Initialisation de la capture clavier via JS
    demo.load(js="""
    function() {
        window.keystrokes = [];
        window.lastKey = 0;
        window.hasPasted = false;
        
        document.addEventListener('keydown', (e) => {
            let now = performance.now();
            if(window.lastKey > 0) window.keystrokes.push(now - window.lastKey);
            window.lastKey = now;
        });
        
        document.addEventListener('paste', (e) => {
            window.hasPasted = true;
        });
        
        console.log("Telemetry tracker initialized.");
    }
    """)

    # Récupération des données lors du clic
    get_telemetry_js = """
    function(u, p, is_bot, current_tel) {
        let avg = 0;
        let std = 0;
        let is_paste = window.hasPasted;
        
        if (is_bot) {
            avg = 5; 
            std = 0.1; // Presque aucune variation
            is_paste = false; 
        } else if (window.keystrokes && window.keystrokes.length > 1) {
            let ks = window.keystrokes;
            avg = ks.reduce((a,b)=>a+b) / ks.length;
            // Calcul de l'écart-type (Standard Deviation)
            let squareDiffs = ks.map(v => Math.pow(v - avg, 2));
            std = Math.sqrt(squareDiffs.reduce((a,b)=>a+b) / ks.length);
        }
        
        let tel = JSON.stringify({
            keystroke: { avg: avg, std: std },
            behavior: { pasted: is_paste }
        });
        
        if(window.keystrokes) window.keystrokes = []; 
        window.hasPasted = false;
        
        return [u, p, is_bot, tel];
    }
    """

    btn.click(
        fn=process_login,
        inputs=[user_input, pwd_input, bot_sim, tel_state],
        outputs=[out_status, out_details],
        js=get_telemetry_js
    )

if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1")
