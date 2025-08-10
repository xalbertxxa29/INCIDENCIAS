document.addEventListener("DOMContentLoaded", () => {
    // --- INICIALIZACIÓN ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();
    const auth = firebase.auth();

    // --- ELEMENTOS DEL DOM ---
    const form = document.getElementById('incidencia-form');
    const tipoIncidenciaInput = document.getElementById('tipo-incidencia-input');
    const tipoIncidenciaList = document.getElementById('tipo-incidencia-list');
    const ubicacionInput = document.getElementById('ubicacion-input');
    const ubicacionList = document.getElementById('ubicacion-list');
    const fotoInput = document.getElementById('foto-input');
    const fotoPreview = document.getElementById('foto-preview');
    const canvas = document.getElementById('firma-canvas');
    const ctx = canvas.getContext('2d');
    const clearFirmaBtn = document.getElementById('clear-firma');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let hasSigned = false;
    let currentUser = null;
    let currentUserData = null;

    // --- FUNCIÓN DE MODAL REUTILIZABLE ---
    function showModal(message, isSuccess = false) {
        if (document.querySelector('.modal-overlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const box = document.createElement('div');
        box.className = 'modal-box';
        box.innerHTML = `<p>${message}</p><button id="modal-ok-btn">Aceptar</button>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        document.getElementById('modal-ok-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (isSuccess) {
                form.reset();
                tipoIncidenciaInput.value = '';
                ubicacionInput.value = '';
                fotoPreview.hidden = true;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                hasSigned = false;
                window.location.href = 'menu.html';
            }
        });
    }

    // --- LÓGICA MEJORADA PARA DESPLEGABLES CON BÚSQUEDA ---
    function createSearchableDropdown(input, listContainer, items) {
        function populateList(itemsToShow) {
            listContainer.innerHTML = '';
            itemsToShow.forEach(item => {
                const optionDiv = document.createElement('div');
                optionDiv.textContent = item;
                optionDiv.addEventListener('click', () => {
                    input.value = item;
                    listContainer.classList.remove('show');
                });
                listContainer.appendChild(optionDiv);
            });
            listContainer.classList.add('show');
        }

        input.addEventListener('click', (e) => {
            e.stopPropagation();
            populateList(items);
        });

        input.addEventListener('input', () => {
            const filter = input.value.toUpperCase();
            const filteredItems = items.filter(item => item.toUpperCase().includes(filter));
            populateList(filteredItems);
        });
    }

    document.addEventListener('click', () => {
        tipoIncidenciaList.classList.remove('show');
        ubicacionList.classList.remove('show');
    });

    // --- FUNCIONES PARA POBLAR LOS DATOS DINÁMICAMENTE ---
    async function populateTiposDeIncidencia(cliente, unidad) {
        try {
            const docRef = await db.collection('DATOS').doc(cliente).collection('UNIDAD').doc(unidad).get();
            if (docRef.exists) {
                const data = docRef.data();
                const items = Object.values(data).sort();
                createSearchableDropdown(tipoIncidenciaInput, tipoIncidenciaList, items);
            } else {
                 tipoIncidenciaInput.placeholder = "No hay tipos de incidencia";
            }
        } catch (error) {
            console.error("Error al cargar Tipos de Incidencia:", error);
            tipoIncidenciaInput.placeholder = "Error al cargar datos";
        }
    }

    async function populateUbicaciones(cliente, unidad) {
        try {
            const docRef = await db.collection('UBICACIONES').doc(cliente).collection('UNIDAD').doc(unidad).get();
            if (docRef.exists) {
                const data = docRef.data();
                const items = Object.values(data).sort();
                createSearchableDropdown(ubicacionInput, ubicacionList, items);
            } else {
                ubicacionInput.placeholder = "No hay ubicaciones";
            }
        } catch (error) {
            console.error("Error al cargar Ubicaciones:", error);
            ubicacionInput.placeholder = "Error al cargar datos";
        }
    }
    
    // --- LÓGICA DE INICIALIZACIÓN DE PÁGINA ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            loadingOverlay.hidden = false;
            try {
                const userId = currentUser.email.split('@')[0];
                const userDoc = await db.collection('USUARIOS').doc(userId).get();
                if (userDoc.exists) {
                    currentUserData = userDoc.data();
                    const cliente = currentUserData.CLIENTE;
                    const unidad = currentUserData.UNIDAD;

                    if (cliente && unidad) {
                        await Promise.all([
                            populateTiposDeIncidencia(cliente, unidad),
                            populateUbicaciones(cliente, unidad)
                        ]);
                    } else {
                         console.error("Faltan datos de Cliente o Unidad en el perfil del usuario.");
                    }
                }
            } catch (error) {
                console.error("Error al obtener los datos del usuario para los desplegables:", error);
            } finally {
                loadingOverlay.hidden = true;
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // --- FUNCIÓN PARA OBTENER GEOLOCALIZACIÓN ---
    function getGeolocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.error("La geolocalización no es soportada por este navegador.");
                resolve(null); // Resuelve con null si no hay soporte
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });
                    },
                    () => {
                        console.error("No se pudo obtener la ubicación. El usuario pudo haber denegado el permiso.");
                        showModal("No se pudo obtener la ubicación. Asegúrate de tener activado el GPS y dar permisos a la aplicación.");
                        resolve(null); // Resuelve con null si el usuario deniega o hay error
                    }
                );
            }
        });
    }

    // --- LÓGICA DE FOTOGRAFÍA ---
    fotoInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                fotoPreview.src = event.target.result;
                fotoPreview.hidden = false;
            }
            reader.readAsDataURL(file);
        }
    });

    // --- LÓGICA DE FIRMA DIGITAL ---
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    function resizeCanvas() { const rect = canvas.getBoundingClientRect(); canvas.width = rect.width; canvas.height = rect.height; }
    window.addEventListener('load', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);
    function startDraw(e) { drawing = true; hasSigned = true; [lastX, lastY] = [e.offsetX, e.offsetY]; }
    function draw(e) { if (!drawing) return; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); [lastX, lastY] = [e.offsetX, e.offsetY]; }
    function stopDraw() { drawing = false; }
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); const touch = e.touches[0]; const rect = canvas.getBoundingClientRect(); const touchX = touch.clientX - rect.left; const touchY = touch.clientY - rect.top; startDraw({ offsetX: touchX, offsetY: touchY }); });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); const touch = e.touches[0]; const rect = canvas.getBoundingClientRect(); const touchX = touch.clientX - rect.left; const touchY = touch.clientY - rect.top; draw({ offsetX: touchX, offsetY: touchY }); });
    canvas.addEventListener('touchend', e => { e.preventDefault(); stopDraw(); });
    clearFirmaBtn.addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasSigned = false; });


    // --- LÓGICA DE ENVÍO DEL FORMULARIO ---
    form.addEventListener('submit', async e => {
        e.preventDefault();

        if (!tipoIncidenciaInput.value.trim() || !ubicacionInput.value.trim() || !document.getElementById('descripcion').value.trim() || !hasSigned) {
            showModal('Por favor, complete todos los campos obligatorios: tipo, ubicación, descripción y firma.');
            return;
        }

        loadingOverlay.hidden = false;

        try {
            // Obtener geolocalización
            const location = await getGeolocation();

            let fotoURL = null;
            if (fotoInput.files[0]) {
                const fotoFile = fotoInput.files[0];
                const fotoRef = storage.ref(`incidencias/${Date.now()}_${fotoFile.name}`);
                const snapshot = await fotoRef.put(fotoFile);
                fotoURL = await snapshot.ref.getDownloadURL();
            }

            const firmaBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const firmaRef = storage.ref(`firmas/${Date.now()}_firma.png`);
            const firmaSnapshot = await firmaRef.put(firmaBlob);
            const firmaURL = await firmaSnapshot.ref.getDownloadURL();

            // --- OBJETO DE DATOS ACTUALIZADO CON GEOLOCALIZACIÓN ---
            const incidenciaData = {
                // Datos del formulario
                tipo: tipoIncidenciaInput.value,
                ubicacion: ubicacionInput.value,
                descripcion: document.getElementById('descripcion').value,
                fotoURL: fotoURL,
                firmaURL: firmaURL,
                fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                
                // Datos del usuario que registra
                usuarioEmail: currentUser.email,
                usuarioId: currentUser.email.split('@')[0],
                nombreCompleto: `${currentUserData.NOMBRES} ${currentUserData.APELLIDOS}`,
                cliente: currentUserData.CLIENTE,
                unidad: currentUserData.UNIDAD,

                // Datos de geolocalización
                geolocalizacion: location ? new firebase.firestore.GeoPoint(location.latitude, location.longitude) : null
            };

            await db.collection('INCIDENCIAS_REGISTRADAS').add(incidenciaData);
            showModal('¡Incidencia guardada correctamente!', true);

        } catch (error) {
            console.error('Error al guardar la incidencia:', error);
            showModal('Hubo un error al guardar. Por favor, inténtelo de nuevo.');
        } finally {
            loadingOverlay.hidden = true;
        }
    });
});
