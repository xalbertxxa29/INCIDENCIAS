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
    const addTipoIncidenciaBtn = document.getElementById('add-tipo-incidencia-btn');
    const ubicacionInput = document.getElementById('ubicacion-input');
    const ubicacionList = document.getElementById('ubicacion-list');
    const addUbicacionBtn = document.getElementById('add-ubicacion-btn');
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

    // --- NUEVA FUNCIÓN PARA MODAL DE AÑADIR ÍTEMS ---
    function showAddItemModal(title, onSave) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const box = document.createElement('div');
        box.className = 'modal-box';
        box.innerHTML = `
            <h3>${title}</h3>
            <div class="input-group" style="margin-top: 1.5rem;">
                <input type="text" id="new-item-input" placeholder="Escriba el nuevo valor...">
            </div>
            <div class="button-group">
                <button id="modal-cancel-btn" class="btn-secondary">Cancelar</button>
                <button id="modal-save-btn" class="btn-primary">Guardar</button> 
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const newItemInput = document.getElementById('new-item-input');
        newItemInput.focus();

        document.getElementById('modal-cancel-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        document.getElementById('modal-save-btn').addEventListener('click', () => {
            const newValue = newItemInput.value.trim();
            if (newValue) {
                onSave(newValue);
                document.body.removeChild(overlay);
            } else {
                newItemInput.style.borderColor = 'red';
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

    // --- FUNCIONES PARA POBLAR Y ACTUALIZAR DATOS ---
    async function populateAndSetupDropdown(collectionName, input, list, cliente, unidad) {
        try {
            const docRef = db.collection(collectionName).doc(cliente).collection('UNIDAD').doc(unidad);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                const items = Object.values(data).sort();
                createSearchableDropdown(input, list, items);
                return items;
            } else {
                input.placeholder = `No hay datos en ${collectionName}`;
                return [];
            }
        } catch (error) {
            console.error(`Error al cargar ${collectionName}:`, error);
            input.placeholder = "Error al cargar datos";
            return [];
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
                    const { CLIENTE, UNIDAD } = currentUserData;

                    if (CLIENTE && UNIDAD) {
                        let tiposIncidenciaItems = await populateAndSetupDropdown('DATOS', tipoIncidenciaInput, tipoIncidenciaList, CLIENTE, UNIDAD);
                        let ubicacionesItems = await populateAndSetupDropdown('UBICACIONES', ubicacionInput, ubicacionList, CLIENTE, UNIDAD);
                        
                        addTipoIncidenciaBtn.onclick = () => {
                            showAddItemModal('Añadir Nuevo Tipo de Incidencia', async (newValue) => {
                                const newIndex = tiposIncidenciaItems.length + 1;
                                await db.collection('DATOS').doc(CLIENTE).collection('UNIDAD').doc(UNIDAD).set({ [newIndex]: newValue.toUpperCase() }, { merge: true });
                                tiposIncidenciaItems = await populateAndSetupDropdown('DATOS', tipoIncidenciaInput, tipoIncidenciaList, CLIENTE, UNIDAD);
                                tipoIncidenciaInput.value = newValue.toUpperCase();
                            });
                        };

                        addUbicacionBtn.onclick = () => {
                            showAddItemModal('Añadir Nueva Ubicación', async (newValue) => {
                                const newIndex = ubicacionesItems.length + 1;
                                await db.collection('UBICACIONES').doc(CLIENTE).collection('UNIDAD').doc(UNIDAD).set({ [newIndex]: newValue.toUpperCase() }, { merge: true });
                                ubicacionesItems = await populateAndSetupDropdown('UBICACIONES', ubicacionInput, ubicacionList, CLIENTE, UNIDAD);
                                ubicacionInput.value = newValue.toUpperCase();
                            });
                        };

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

    // --- LÓGICA DE ENVÍO DEL FORMULARIO (CON COMPRESIÓN) ---
    form.addEventListener('submit', async e => {
        e.preventDefault();

        if (!tipoIncidenciaInput.value.trim() || !ubicacionInput.value.trim() || !document.getElementById('descripcion').value.trim() || !hasSigned) {
            showModal('Por favor, complete todos los campos obligatorios: tipo, ubicación, descripción y firma.');
            return;
        }

        loadingOverlay.hidden = false;

        try {
            let fotoURL = null;
            if (fotoInput.files[0]) {
                const imageFile = fotoInput.files[0];
                console.log(`Tamaño original: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);

                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true
                }
                
                const compressedFile = await imageCompression(imageFile, options);
                console.log(`Tamaño comprimido: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

                const fotoRef = storage.ref(`incidencias/${Date.now()}_${compressedFile.name}`);
                const snapshot = await fotoRef.put(compressedFile);
                fotoURL = await snapshot.ref.getDownloadURL();
            }

            const firmaBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const firmaRef = storage.ref(`firmas/${Date.now()}_firma.png`);
            const firmaSnapshot = await firmaRef.put(firmaBlob);
            const firmaURL = await firmaSnapshot.ref.getDownloadURL();

            const incidenciaData = {
                tipo: tipoIncidenciaInput.value.toUpperCase(),
                ubicacion: ubicacionInput.value.toUpperCase(),
                descripcion: document.getElementById('descripcion').value,
                fotoURL: fotoURL,
                firmaURL: firmaURL,
                fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                usuarioEmail: currentUser.email,
                usuarioId: currentUser.email.split('@')[0],
                nombreCompleto: `${currentUserData.NOMBRES} ${currentUserData.APELLIDOS}`,
                cliente: currentUserData.CLIENTE,
                unidad: currentUserData.UNIDAD
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
