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
    let currentUserData = null; // Variable para guardar los datos del usuario

    // --- LÓGICA DE INICIALIZACIÓN DE PÁGINA ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userId = user.email.split('@')[0];
                const userDoc = await db.collection('USUARIOS').doc(userId).get();
                if (userDoc.exists) {
                    currentUserData = userDoc.data();
                    // Habilitar el input de fecha una vez que tenemos los datos del usuario
                    fechaInput.disabled = false;
                } else {
                    console.error("No se encontraron datos para el usuario actual.");
                    registrosContainer.innerHTML = "<p>No se pudieron cargar los datos del usuario.</p>";
                }
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // Función para cargar registros
    async function cargarRegistros(inicial = false) {
        if (!fechaSeleccionadaGlobal || !currentUserData) {
            showModal("Por favor, selecciona una fecha y asegúrate de que tus datos de usuario han cargado.");
            return;
        }

        loadingOverlay.hidden = false;
        cargarMasBtn.hidden = true;

        const [year, month, day] = fechaSeleccionadaGlobal.split('-').map(Number);
        const inicioDelDia = new Date(year, month - 1, day, 0, 0, 0, 0);
        const finDelDia = new Date(year, month - 1, day, 23, 59, 59, 999);

        // --- QUERY ACTUALIZADO CON FILTROS DE CLIENTE Y UNIDAD ---
        let query = db.collection('INCIDENCIAS_REGISTRADAS')
            .where('fechaRegistro', '>=', inicioDelDia)
            .where('fechaRegistro', '<=', finDelDia)
            .where('cliente', '==', currentUserData.CLIENTE)
            .where('unidad', '==', currentUserData.UNIDAD)
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
                    registrosContainer.innerHTML = '<p>No se encontraron incidencias para esta fecha y unidad.</p>';
                }
            }

            querySnapshot.forEach(doc => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'registro-card';
                const fechaLocal = data.fechaRegistro ? data.fechaRegistro.toDate().toLocaleString('es-PE') : 'Fecha no disponible';
                
                let fotoHTML = '';
                if (data.fotoURL) {
                    const url = new URL(data.fotoURL);
                    const pathParts = url.pathname.split('/');
                    const fileName = pathParts.pop();
                    const newFileName = fileName.replace(/(\.[\w\d_-]+)$/i, '_200x200$1');
                    pathParts.push(newFileName);
                    const thumbnailUrl = `${url.origin}${pathParts.join('/')}?${url.searchParams}`;
                    fotoHTML = `<img src="${thumbnailUrl}" alt="Evidencia" class="registro-foto" onerror="this.src='${data.fotoURL}'">`;
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

            ultimoDocumentoVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

            if (querySnapshot.docs.length === 10) {
                cargarMasBtn.hidden = false;
            }

        } catch (error) {
            console.error("Error al buscar registros: ", error);
            registrosContainer.innerHTML = '<p>Ocurrió un error al cargar los datos. Es posible que necesites crear índices en Firestore.</p>';
        } finally {
            loadingOverlay.hidden = true;
        }
    }

    fechaInput.addEventListener('change', e => {
        fechaSeleccionadaGlobal = e.target.value;
        ultimoDocumentoVisible = null;
        cargarRegistros(true);
    });

    cargarMasBtn.addEventListener('click', () => {
        cargarRegistros(false);
    });
});
