document.addEventListener("DOMContentLoaded", () => {
    // --- INICIALIZACIÓN ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- ELEMENTOS DEL DOM ---
    const fechaInput = document.getElementById('fecha-consulta');
    const registrosContainer = document.getElementById('registros-container');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Redirigir si no está autenticado
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    fechaInput.addEventListener('change', async e => {
        const fechaSeleccionada = e.target.value;
        if (!fechaSeleccionada) return;

        loadingOverlay.hidden = false;
        registrosContainer.innerHTML = '';

        // --- CORRECCIÓN DE ZONA HORARIA ---
        // Se construye la fecha de forma explícita para evitar que el navegador
        // la interprete incorrectamente como UTC, asegurando que la consulta
        // se realice en la zona horaria local del usuario.
        const [year, month, day] = fechaSeleccionada.split('-').map(Number);

        // El mes en el constructor de Date es 0-indexado (Enero=0), por eso se resta 1.
        const inicioDelDia = new Date(year, month - 1, day, 0, 0, 0, 0);
        const finDelDia = new Date(year, month - 1, day, 23, 59, 59, 999);

        try {
            const querySnapshot = await db.collection('INCIDENCIAS_REGISTRADAS')
                .where('fechaRegistro', '>=', inicioDelDia)
                .where('fechaRegistro', '<=', finDelDia)
                .orderBy('fechaRegistro', 'desc')
                .get();

            if (querySnapshot.empty) {
                registrosContainer.innerHTML = '<p>No se encontraron incidencias para esta fecha.</p>';
            } else {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const card = document.createElement('div');
                    card.className = 'registro-card';

                    // Se verifica si fechaRegistro existe antes de convertirlo para evitar errores
                    const fechaLocal = data.fechaRegistro ? data.fechaRegistro.toDate().toLocaleString('es-PE') : 'Fecha no disponible';

                    card.innerHTML = `
                        <h3>${data.tipo}</h3>
                        <p><strong>Ubicación:</strong> ${data.ubicacion}</p>
                        <p><strong>Descripción:</strong> ${data.descripcion}</p>
                        <p><strong>Registrado por:</strong> ${data.usuario}</p>
                        <p><strong>Fecha y Hora:</strong> ${fechaLocal}</p>
                        ${data.fotoURL ? `<img src="${data.fotoURL}" alt="Evidencia" class="registro-foto">` : ''}
                        <p><strong>Firma:</strong></p>
                        <img src="${data.firmaURL}" alt="Firma" class="registro-firma">
                    `;
                    registrosContainer.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Error al buscar registros: ", error);
            registrosContainer.innerHTML = '<p>Ocurrió un error al cargar los datos.</p>';
        } finally {
            loadingOverlay.hidden = true;
        }
    });
});