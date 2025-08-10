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

        const [year, month, day] = fechaSeleccionada.split('-').map(Number);
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
                    const fechaLocal = data.fechaRegistro ? data.fechaRegistro.toDate().toLocaleString('es-PE') : 'Fecha no disponible';
                    
                    // --- PLANTILLA HTML ACTUALIZADA SIN LA FIRMA ---
                    card.innerHTML = `
                        <h3>${data.tipo}</h3>
                        <p><strong>Ubicación:</strong> ${data.ubicacion}</p>
                        <p><strong>Descripción:</strong> ${data.descripcion}</p>
                        <p><strong>Registrado por:</strong> ${data.nombreCompleto || data.usuarioEmail}</p>
                        <p><strong>Fecha y Hora:</strong> ${fechaLocal}</p>
                        ${data.fotoURL ? `<img src="${data.fotoURL}" alt="Evidencia" class="registro-foto">` : ''}
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
