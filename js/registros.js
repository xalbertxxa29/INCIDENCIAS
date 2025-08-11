document.addEventListener("DOMContentLoaded", () => {
    // --- INICIALIZACIÓN ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- ELEMENTOS DEL DOM ---
    const fechaInput = document.getElementById('fecha-consulta');
    const registrosContainer = document.getElementById('registros-container');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const cargarMasBtn = document.getElementById('cargar-mas-btn');

    let ultimoDocumentoVisible = null;
    let fechaSeleccionadaGlobal = null;

    // Redirigir si no está autenticado
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    // Función para cargar registros
    async function cargarRegistros(inicial = false) {
        if (!fechaSeleccionadaGlobal) return;

        loadingOverlay.hidden = false;
        cargarMasBtn.hidden = true;

        const [year, month, day] = fechaSeleccionadaGlobal.split('-').map(Number);
        const inicioDelDia = new Date(year, month - 1, day, 0, 0, 0, 0);
        const finDelDia = new Date(year, month - 1, day, 23, 59, 59, 999);

        let query = db.collection('INCIDENCIAS_REGISTRADAS')
            .where('fechaRegistro', '>=', inicioDelDia)
            .where('fechaRegistro', '<=', finDelDia)
            .orderBy('fechaRegistro', 'desc')
            .limit(10);

        if (!inicial && ultimoDocumentoVisible) {
            query = query.startAfter(ultimoDocumentoVisible);
        }

        try {
            const querySnapshot = await query.get();

            if (inicial) {
                registrosContainer.innerHTML = '';
                if (querySnapshot.empty) {
                    registrosContainer.innerHTML = '<p>No se encontraron incidencias para esta fecha.</p>';
                }
            }

            querySnapshot.forEach(doc => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'registro-card';
                const fechaLocal = data.fechaRegistro ? data.fechaRegistro.toDate().toLocaleString('es-PE') : 'Fecha no disponible';
                
                // Lógica para usar la miniatura si existe
                let fotoHTML = '';
                if (data.fotoURL) {
                    // Asume que la extensión "Resize Images" crea un archivo con el sufijo _200x200
                    const url = new URL(data.fotoURL);
                    const pathParts = url.pathname.split('/');
                    const fileName = pathParts.pop();
                    const newFileName = fileName.replace(/(\.[\w\d_-]+)$/i, '_200x200$1');
                    pathParts.push(newFileName);
                    const thumbnailUrl = `${url.origin}${pathParts.join('/')}?${url.searchParams}`;
                    fotoHTML = `<img src="${thumbnailUrl}" alt="Evidencia" class="registro-foto" onerror="this.src='${data.fotoURL}'">`; // Fallback a la original si la miniatura no carga
                }

                card.innerHTML = `
                    <h3>${data.tipo}</h3>
                    <p><strong>Ubicación:</strong> ${data.ubicacion}</p>
                    <p><strong>Descripción:</strong> ${data.descripcion}</p>
                    <p><strong>Registrado por:</strong> ${data.nombreCompleto || data.usuarioEmail}</p>
                    <p><strong>Fecha y Hora:</strong> ${fechaLocal}</p>
                    ${fotoHTML}
                `;
                registrosContainer.appendChild(card);
            });

            // Guardar el último documento para la siguiente página
            ultimoDocumentoVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

            // Mostrar el botón "Cargar más" si hay más documentos
            if (querySnapshot.docs.length === 10) {
                cargarMasBtn.hidden = false;
            }

        } catch (error) {
            console.error("Error al buscar registros: ", error);
            registrosContainer.innerHTML = '<p>Ocurrió un error al cargar los datos.</p>';
        } finally {
            loadingOverlay.hidden = true;
        }
    }

    // Evento para cuando se cambia la fecha
    fechaInput.addEventListener('change', e => {
        fechaSeleccionadaGlobal = e.target.value;
        ultimoDocumentoVisible = null; // Reiniciar paginación
        cargarRegistros(true); // Carga inicial
    });

    // Evento para el botón "Cargar más"
    cargarMasBtn.addEventListener('click', () => {
        cargarRegistros(false); // Cargar siguiente página
    });
});
