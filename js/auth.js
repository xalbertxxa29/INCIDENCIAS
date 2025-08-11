// js/auth.js

document.addEventListener("DOMContentLoaded", () => {
  // --- INICIALIZACIÓN ---
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Error al inicializar Firebase.", e);
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const loadingOverlay = document.getElementById("loadingOverlay");

  // --- FUNCIÓN DE MODAL PARA MENSAJES ---
  function showAuthModal(message) {
      if (document.querySelector('.modal-overlay')) return;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const box = document.createElement('div');
      box.className = 'modal-box';
      box.innerHTML = `
          <p>${message}</p>
          <button id="modal-ok-btn">Aceptar</button>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      document.getElementById('modal-ok-btn').addEventListener('click', () => {
          document.body.removeChild(overlay);
      });
  }

  // --- LÓGICA DE LOGIN ---
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    loadingOverlay.hidden = false;

    const userId = document.getElementById("login-id").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const rememberMe = document.getElementById("remember-me-checkbox").checked;

    if (!userId || !password) {
        showAuthModal("Por favor, completa todos los campos.");
        loadingOverlay.hidden = true;
        return;
    }

    try {
        const persistence = rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
        await auth.setPersistence(persistence);

        const userDocRef = db.collection('USUARIOS').doc(userId);
        const docSnap = await userDocRef.get();

        if (!docSnap.exists) {
            showAuthModal("El ID de usuario no está registrado.");
            loadingOverlay.hidden = true;
            return;
        }

        const userData = docSnap.data();
        const estadoUsuario = userData.ESTADO;
        
        if (estadoUsuario !== 'ACTIVO') {
            const mensaje = `Su usuario está en estado "${estadoUsuario || 'INDEFINIDO'}", comunícate con tu zonal.`;
            showAuthModal(mensaje);
            loadingOverlay.hidden = true;
            return;
        }

        const cliente = userData.CLIENTE;
        const constructedEmail = `${userId}@${cliente}.com.pe`;

        await auth.signInWithEmailAndPassword(constructedEmail, password);
        window.location.href = "menu.html";

    } catch (error) {
        console.error("Error de inicio de sesión:", error);
        if (error.code === 'auth/wrong-password') {
            showAuthModal("Contraseña incorrecta.");
        } else {
            showAuthModal("Ocurrió un error al iniciar sesión.");
        }
    } finally {
        loadingOverlay.hidden = true;
    }
  });

  // --- LÓGICA DE REGISTRO (ACTUALIZADA) ---
  const registerForm = document.getElementById("register-form");

  registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    loadingOverlay.hidden = false;

    const userId = document.getElementById("register-id").value.trim();
    const nombres = document.getElementById("register-nombres").value.trim();
    const apellidos = document.getElementById("register-apellidos").value.trim();
    const cliente = document.getElementById("register-cliente").value.trim();
    const unidad = document.getElementById("register-unidad").value.trim();
    const tipo = document.getElementById("register-tipo").value.trim();
    const password = document.getElementById("register-password").value;
    const passwordConfirm = document.getElementById("register-password-confirm").value;

    if (!userId || !nombres || !apellidos || !cliente || !unidad || !password || !passwordConfirm) {
        showAuthModal("Por favor, complete todos los campos.");
        loadingOverlay.hidden = true;
        return;
    }

    if (password !== passwordConfirm) {
        showAuthModal("Los campos Contraseña y Repetir Contraseña no son iguales.");
        document.getElementById("register-password").value = "";
        document.getElementById("register-password-confirm").value = "";
        loadingOverlay.hidden = true;
        return;
    }

    // --- CAMBIO CLAVE AQUÍ ---
    // El dominio ahora es siempre @liderman.com.pe
    const constructedEmail = `${userId}@liderman.com.pe`;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(constructedEmail, password);
        
        const userData = {
            NOMBRES: nombres.toUpperCase(),
            APELLIDOS: apellidos.toUpperCase(),
            CLIENTE: cliente.toUpperCase(),
            UNIDAD: unidad.toUpperCase(),
            TIPO: tipo.toUpperCase(),
            ESTADO: "INACTIVO"
        };

        await db.collection('USUARIOS').doc(userId).set(userData);

        showAuthModal("¡Usuario registrado exitosamente! Su cuenta está pendiente de activación.");
        registerForm.reset();

    } catch (error) {
        console.error("Error al registrar:", error);
        if (error.code === 'auth/email-already-in-use') {
            showAuthModal("Este ID de usuario ya está registrado.");
        } else if (error.code === 'auth/weak-password') {
            showAuthModal("La contraseña debe tener al menos 6 caracteres.");
        } else {
            showAuthModal("Ocurrió un error durante el registro.");
        }
    } finally {
        loadingOverlay.hidden = true;
    }
  });
});
