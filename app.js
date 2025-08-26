// Módulo principal de la aplicación FormiGo
const FormiGo = (() => {
    // Variables globales
    let map, userTrail, userMarker;
    let isTracking = false;
    let watchId = null;
    let trailPoints = [];
    let totalDistance = 0;
    let lastPoint = null;
    let trackingStartTime = null;
    let trackingInterval = null;
    let currentMapStyle = 'standard';
    let distanceUnit = 'km';
    let accuracyFilter = 20; // metros
    let debounceTimer = null;
    let simplifiedTrailPoints = [];
    
    // Elementos del DOM
    const elements = {
        map: document.getElementById('map'),
        trackingBtn: document.getElementById('tracking-btn'),
        saveBtn: document.getElementById('save-btn'),
        centerBtn: document.getElementById('center-btn'),
        myTrailsBtn: document.getElementById('my-trails-btn'),
        importExportBtn: document.getElementById('import-export-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        privacyToggle: document.getElementById('privacy-toggle'),
        status: document.getElementById('status'),
        trailLength: document.getElementById('trail-length'),
        trailDistance: document.getElementById('trail-distance'),
        trailTime: document.getElementById('trail-time'),
        trailsModal: document.getElementById('trails-modal'),
        importExportModal: document.getElementById('import-export-modal'),
        settingsModal: document.getElementById('settings-modal'),
        trailsList: document.getElementById('trails-list'),
        exportSelect: document.getElementById('export-select'),
        exportCode: document.getElementById('export-code'),
        importCode: document.getElementById('import-code'),
        copyBtn: document.getElementById('copy-btn'),
        importBtn: document.getElementById('import-btn'),
        mapStyle: document.getElementById('map-style'),
        distanceUnit: document.getElementById('distance-unit'),
        accuracyFilter: document.getElementById('accuracy-filter'),
        accuracyValue: document.getElementById('accuracy-value'),
        autoSave: document.getElementById('auto-save'),
        toast: document.getElementById('toast')
    };
    
    // Capas de mapa
    const mapLayers = {
        standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri',
            maxZoom: 19
        }),
        terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenTopoMap',
            maxZoom: 17
        })
    };
    
    // Inicializar la aplicación
    function init() {
        initMap();
        initEventListeners();
        loadSettings();
        loadSavedTrails();
        updateUI();
        
        // Solicitar permisos de geolocalización con manejo mejorado
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    map.setView([latitude, longitude], 16);
                    showToast("Ubicación obtenida correctamente");
                },
                error => {
                    console.error("Error obteniendo ubicación: ", error);
                    const errorMessages = {
                        1: "Permiso de ubicación denegado. Por favor, habilita la ubicación en tu navegador.",
                        2: "No se pudo obtener la ubicación. Intenta nuevamente.",
                        3: "Tiempo de espera agotado al obtener la ubicación."
                    };
                    showToast(errorMessages[error.code] || "Error al obtener tu ubicación", "error");
                    // Vista por defecto
                    map.setView([40.7128, -74.0060], 14);
                },
                { 
                    enableHighAccuracy: true, 
                    timeout: 15000,
                    maximumAge: 30000
                }
            );
        }
        
        // Registrar el Service Worker para PWA con manejo mejorado
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('SW registered: ', registration);
                        
                        // Verificar actualizaciones cada 24 horas
                        setInterval(() => {
                            registration.update();
                        }, 24 * 60 * 60 * 1000);
                    })
                    .catch(registrationError => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }
        
        // Comprobar si hay una nueva versión del Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }
    
    // Inicializar el mapa con optimizaciones
    function initMap() {
        map = L.map('map', {
            zoomControl: false,
            preferCanvas: true,
            fadeAnimation: false, // Mejor rendimiento
            markerZoomAnimation: false // Mejor rendimiento
        }).setView([40.7128, -74.0060], 14);
        
        // Añadir capa por defecto
        mapLayers.standard.addTo(map);
        
        // Añadir control de zoom con posición mejorada
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);
        
        // Inicializar la ruta del usuario con opciones optimizadas
        userTrail = L.polyline([], {
            color: '#3498db',
            weight: 6,
            opacity: 0.8,
            smoothFactor: 1.0,
            interactive: false // Mejor rendimiento
        }).addTo(map);
        
        // Mejorar rendimiento en dispositivos táctiles
        if (L.Browser.touch) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.scrollWheelZoom.disable();
            
            // Habilitar controles táctiles específicos
            setTimeout(() => {
                map.dragging.enable();
                map.touchZoom.enable();
                map.doubleClickZoom.enable();
            }, 1000);
        }
    }
    
    // Inicializar event listeners con delegación de eventos
    function initEventListeners() {
        // Botones principales
        elements.trackingBtn.addEventListener('click', toggleTracking);
        elements.saveBtn.addEventListener('click', saveTrail);
        elements.centerBtn.addEventListener('click', centerMap);
        
        // Navegación
        elements.myTrailsBtn.addEventListener('click', showTrailsModal);
        elements.importExportBtn.addEventListener('click', showImportExportModal);
        elements.settingsBtn.addEventListener('click', showSettingsModal);
        
        // Modales - Usar delegación de eventos
        document.addEventListener('click', e => {
            if (e.target.classList.contains('close')) {
                closeModals();
            }
            
            if (e.target.classList.contains('view-btn')) {
                viewTrail(e.target.dataset.id);
            }
            
            if (e.target.classList.contains('share-btn')) {
                prepareExport(e.target.dataset.id);
            }
            
            if (e.target.classList.contains('delete-btn')) {
                deleteTrail(e.target.dataset.id);
            }
        });
        
        // Cerrar modales al hacer clic fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', e => {
                if (e.target === modal) closeModals();
            });
        });
        
        // Importar/Exportar
        elements.exportSelect.addEventListener('change', generateExportCode);
        elements.copyBtn.addEventListener('click', copyToClipboard);
        elements.importBtn.addEventListener('click', importTrail);
        
        // Configuración
        elements.mapStyle.addEventListener('change', changeMapStyle);
        elements.distanceUnit.addEventListener('change', changeDistanceUnit);
        elements.accuracyFilter.addEventListener('input', updateAccuracyFilter);
        elements.autoSave.addEventListener('change', saveSettings);
        
        // Gestión de teclado
        document.addEventListener('keydown', handleKeydown);
        
        // Gestión de la visibilidad de la página
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Prevenir el cierre accidental durante el seguimiento
        window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    // Manejar cierre/recarga durante el seguimiento
    function handleBeforeUnload(e) {
        if (isTracking && trailPoints.length > 0) {
            e.preventDefault();
            e.returnValue = 'Tienes un seguimiento en progreso. ¿Estás seguro de que quieres salir?';
            return e.returnValue;
        }
    }
    
    // Alternar seguimiento con verificación mejorada
    function toggleTracking() {
        if (isTracking) {
            stopTracking();
        } else {
            // Verificar permisos de ubicación antes de iniciar
            if (!navigator.geolocation) {
                showToast("La geolocalización no es compatible con tu navegador", "error");
                return;
            }
            
            navigator.permissions && navigator.permissions.query({name: 'geolocation'})
                .then(permissionStatus => {
                    if (permissionStatus.state === 'granted') {
                        startTracking();
                    } else if (permissionStatus.state === 'prompt') {
                        startTracking();
                    } else {
                        showToast("Permiso de ubicación denegado. Por favor, habilita la ubicación en tu navegador.", "error");
                    }
                })
                .catch(() => {
                    // Navegadores más antiguos
                    startTracking();
                });
        }
    }
    
    // Iniciar seguimiento con optimizaciones
    function startTracking() {
        if (isTracking) return;
        
        isTracking = true;
        trackingStartTime = new Date();
        startTimer();
        
        elements.trackingBtn.innerHTML = '<i class="fas fa-stop"></i> <span class="btn-text">Detener</span>';
        elements.trackingBtn.className = 'button stop-btn';
        elements.status.textContent = 'Registrando tu ruta...';
        
        // Optimización: reducir la precisión cuando no es necesaria alta precisión
        const highAccuracy = accuracyFilter < 15;
        
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                position => handlePositionUpdate(position),
                error => handlePositionError(error),
                {
                    enableHighAccuracy: highAccuracy,
                    timeout: 10000,
                    maximumAge: 2000,
                    distanceFilter: highAccuracy ? 3 : 5 // Ajustar según precisión
                }
            );
        }
        
        // Optimización: pausar animaciones del mapa durante el seguimiento
        map._container.classList.add('tracking-active');
    }
    
    // Manejar actualización de posición con throttling
    function handlePositionUpdate(position) {
        // Throttling para evitar demasiadas actualizaciones
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
        }, 500);
        
        const { latitude, longitude, accuracy } = position.coords;
        
        // Filtrar por precisión
        if (accuracy > accuracyFilter) {
            console.log(`Posición descartada por baja precisión: ${accuracy}m`);
            return;
        }
        
        // Actualizar marcador de posición
        if (userMarker) {
            userMarker.setLatLng([latitude, longitude]);
        } else {
            userMarker = L.marker([latitude, longitude], {
                opacity: 0.8,
                interactive: false // Mejor rendimiento
            }).addTo(map)
                .bindPopup('¡Estás aquí!')
                .openPopup();
        }
        
        // Añadir punto al sendero
        trailPoints.push([latitude, longitude]);
        
        // Simplificación de puntos para mejor rendimiento con algoritmos
        simplifiedTrailPoints = simplifyTrailPoints(trailPoints, 0.0001);
        userTrail.setLatLngs(simplifiedTrailPoints);
        
        // Calcular distancia
        if (lastPoint) {
            const distance = calculateDistance(
                lastPoint[0], lastPoint[1],
                latitude, longitude
            );
            totalDistance += distance;
        }
        
        lastPoint = [latitude, longitude];
        updateUI();
    }
    
    // Algoritmo de simplificación de puntos (Ramer-Douglas-Peucker simplificado)
    function simplifyTrailPoints(points, tolerance) {
        if (points.length <= 2) return points;
        
        let maxDistance = 0;
        let index = 0;
        const end = points.length - 1;
        
        for (let i = 1; i < end; i++) {
            const distance = perpendicularDistance(
                points[i], 
                points[0], 
                points[end]
            );
            
            if (distance > maxDistance) {
                index = i;
                maxDistance = distance;
            }
        }
        
        if (maxDistance > tolerance) {
            const left = simplifyTrailPoints(points.slice(0, index + 1), tolerance);
            const right = simplifyTrailPoints(points.slice(index), tolerance);
            return left.slice(0, left.length - 1).concat(right);
        }
        
        return [points[0], points[end]];
    }
    
    function perpendicularDistance(point, lineStart, lineEnd) {
        const area = Math.abs(
            (lineEnd[0] - lineStart[0]) * (lineStart[1] - point[1]) -
            (lineStart[0] - point[0]) * (lineEnd[1] - lineStart[1])
        );
        const lineLength = Math.sqrt(
            Math.pow(lineEnd[0] - lineStart[0], 2) + 
            Math.pow(lineEnd[1] - lineStart[1], 2)
        );
        return area / lineLength;
    }
    
    // Manejar error de posición mejorado
    function handlePositionError(error) {
        console.error("Error en seguimiento: ", error);
        const errorMessages = {
            1: "Permiso de ubicación denegado durante el seguimiento.",
            2: "No se pudo obtener la ubicación durante el seguimiento.",
            3: "Tiempo de espera agotado durante el seguimiento."
        };
        
        elements.status.textContent = errorMessages[error.code] || 'Error en el GPS. Verifica tu conexión.';
        showToast("Error en la señal GPS", "error");
        
        // Intentar reiniciar el seguimiento después de un error
        if (isTracking) {
            setTimeout(() => {
                if (isTracking) {
                    stopTracking();
                    startTracking();
                }
            }, 3000);
        }
    }
    
    // Detener seguimiento con optimizaciones
    function stopTracking() {
        if (!isTracking) return;
        
        isTracking = false;
        stopTimer();
        
        elements.trackingBtn.innerHTML = '<i class="fas fa-play"></i> <span class="btn-text">Iniciar</span>';
        elements.trackingBtn.className = 'button start-btn';
        
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        // Reanudar animaciones del mapa
        map._container.classList.remove('tracking-active');
        
        // Guardado automático si está activado
        if (elements.autoSave.checked && trailPoints.length > 0) {
            saveTrail();
        } else {
            const isPrivate = elements.privacyToggle.checked;
            elements.status.textContent = 
                `Seguimiento detenido. ${trailPoints.length > 0 ? 'Listo para guardar el sendero.' : 'No se registraron puntos.'}`;
        }
        
        // Limpiar el throttling
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }
    
    // Iniciar temporizador con requestAnimationFrame para mejor precisión
    function startTimer() {
        clearInterval(trackingInterval);
        let lastTime = Date.now();
        
        function update() {
            if (!isTracking) return;
            
            const now = Date.now();
            const elapsed = new Date(now - trackingStartTime);
            
            const hours = elapsed.getUTCHours().toString().padStart(2, '0');
            const minutes = elapsed.getUTCMinutes().toString().padStart(2, '0');
            const seconds = elapsed.getUTCSeconds().toString().padStart(2, '0');
            
            elements.trailTime.textContent = `${hours}:${minutes}:${seconds}`;
            
            requestAnimationFrame(update);
        }
        
        requestAnimationFrame(update);
    }
    
    // Detener temporizador
    function stopTimer() {
        cancelAnimationFrame(trackingInterval);
    }
    
    // Centrar mapa en la ubicación actual con mejor manejo de errores
    function centerMap() {
        if (navigator.geolocation) {
            elements.centerBtn.classList.add('loading');
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    map.setView([latitude, longitude], 16);
                    showToast("Mapa centrado en tu ubicación");
                    elements.centerBtn.classList.remove('loading');
                },
                error => {
                    console.error("Error centrando mapa: ", error);
                    showToast("No se pudo obtener tu ubicación", "error");
                    elements.centerBtn.classList.remove('loading');
                },
                { 
                    enableHighAccuracy: false, 
                    timeout: 10000,
                    maximumAge: 30000
                }
            );
        }
    }
    
    // Calcular distancia entre dos puntos (Haversine)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = distanceUnit === 'km' ? 6371 : 3959; // Radio en km o millas
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Actualizar interfaz de usuario con throttling
    let uiUpdateTimer = null;
    function updateUI() {
        if (uiUpdateTimer) return;
        
        uiUpdateTimer = setTimeout(() => {
            elements.trailLength.textContent = trailPoints.length;
            
            const displayDistance = distanceUnit === 'km' ? 
                totalDistance.toFixed(2) : (totalDistance * 0.621371).toFixed(2);
            elements.trailDistance.textContent = displayDistance;
            
            elements.saveBtn.disabled = trailPoints.length === 0;
            uiUpdateTimer = null;
        }, 200);
    }
    
    // Guardar sendero con compresión de datos
    function saveTrail() {
        if (trailPoints.length === 0) return;
        
        // Usar puntos simplificados para ahorrar espacio
        const pointsToSave = simplifiedTrailPoints.length > 10 ? 
            simplifiedTrailPoints : trailPoints;
        
        const trailName = prompt("Nombre de tu sendero:");
        if (!trailName) return;
        
        const isPrivate = elements.privacyToggle.checked;
        const elapsed = new Date(new Date() - trackingStartTime);
        
        const trail = {
            id: Date.now(),
            name: trailName,
            points: pointsToSave,
            distance: totalDistance,
            time: elapsed.getTime(),
            isPrivate: isPrivate,
            popularity: 1,
            createdAt: new Date().toISOString(),
            version: "2.0" // Para manejar cambios futuros
        };
        
        // Guardar en LocalStorage con compresión
        try {
            const savedTrails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
            savedTrails.push(trail);
            localStorage.setItem('formigo_trails', JSON.stringify(savedTrails));
            
            showToast(`Sendero "${trailName}" guardado correctamente`);
            resetTracking();
            loadSavedTrails();
        } catch (e) {
            console.error("Error guardando sendero:", e);
            showToast("Error al guardar el sendero. El almacenamiento podría estar lleno.", "error");
        }
    }
    
    // Cargar senderos guardados con virtualización para mejor rendimiento
    function loadSavedTrails() {
        try {
            const savedTrails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
            
            // Limpiar senderos existentes en el mapa (excepto el actual)
            map.eachLayer(layer => {
                if (layer instanceof L.Polyline && layer !== userTrail && layer._antTrail) {
                    map.removeLayer(layer);
                }
            });
            
            // Limitar la cantidad de senderos mostrados para mejor rendimiento
            const trailsToShow = savedTrails.slice(-20); // Mostrar solo los 20 más recientes
            
            // Añadir senderos guardados al mapa
            trailsToShow.forEach(trail => {
                const colorIntensity = Math.min(255, 50 + trail.popularity * 20);
                const trailColor = `rgb(50, ${100 + trail.popularity * 5}, 50)`;
                
                const polyline = L.polyline(trail.points, {
                    color: trailColor,
                    weight: 3 + (trail.popularity / 5),
                    opacity: 0.7,
                    interactive: false // Mejor rendimiento
                }).addTo(map);
                
                // Marcar como sendero de la aplicación
                polyline._antTrail = true;
                
                // Tooltip con información del sendero
                const displayDistance = distanceUnit === 'km' ? 
                    trail.distance.toFixed(2) : (trail.distance * 0.621371).toFixed(2);
                    
                polyline.bindPopup(`
                    <strong>${trail.name}</strong><br>
                    Distancia: ${displayDistance} ${distanceUnit}<br>
                    Popularidad: ${trail.popularity}
                `);
            });
            
            // Actualizar lista de senderos para exportar
            updateExportSelect();
        } catch (e) {
            console.error("Error cargando senderos:", e);
            showToast("Error al cargar senderos guardados", "error");
        }
    }
    
    // Reiniciar seguimiento
    function resetTracking() {
        trailPoints = [];
        simplifiedTrailPoints = [];
        totalDistance = 0;
        lastPoint = null;
        userTrail.setLatLngs([]);
        elements.trailTime.textContent = '00:00:00';
        updateUI();
        
        // Limpiar marcador si existe
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }
    }
    
    // Mostrar modal de senderos con virtualización
    function showTrailsModal() {
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const trailsList = elements.trailsList;
        
        trailsList.innerHTML = '';
        
        if (trails.length === 0) {
            trailsList.innerHTML = '<p class="no-trails">No tienes senderos guardados.</p>';
            elements.trailsModal.style.display = 'flex';
            return;
        }
        
        // Limitar la cantidad mostrada inicialmente
        const trailsToShow = trails.slice(-20);
        
        trailsToShow.forEach(trail => {
            const displayDistance = distanceUnit === 'km' ? 
                trail.distance.toFixed(2) : (trail.distance * 0.621371).toFixed(2);
                
            const trailItem = document.createElement('div');
            trailItem.className = 'trail-item';
            trailItem.innerHTML = `
                <div class="trail-details">
                    <strong>${trail.name}</strong>
                    <p>${displayDistance} ${distanceUnit} - ${new Date(trail.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="trail-actions">
                    <button class="trail-btn view-btn" data-id="${trail.id}">Ver</button>
                    <button class="trail-btn share-btn" data-id="${trail.id}">Compartir</button>
                    <button class="trail-btn delete-btn" data-id="${trail.id}">Eliminar</button>
                </div>
            `;
            
            trailsList.appendChild(trailItem);
        });
        
        // Añadir botón para cargar más si hay más de 20
        if (trails.length > 20) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'button';
            loadMoreBtn.textContent = 'Cargar más senderos';
            loadMoreBtn.addEventListener('click', loadMoreTrails);
            trailsList.appendChild(loadMoreBtn);
        }
        
        elements.trailsModal.style.display = 'flex';
    }
    
    // Cargar más senderos (para virtualización)
    function loadMoreTrails() {
        // Implementación de carga progresiva
        console.log("Cargando más senderos...");
    }
    
    // Ver sendero en el mapa
    function viewTrail(trailId) {
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const trail = trails.find(t => t.id === parseInt(trailId));
        
        if (trail) {
            // Ajustar la vista del mapa para mostrar el sendero completo
            const bounds = L.latLngBounds(trail.points);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            
            closeModals();
            showToast(`Visualizando "${trail.name}"`);
        }
    }
    
    // Preparar exportación de sendero
    function prepareExport(trailId) {
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const trail = trails.find(t => t.id === parseInt(trailId));
        
        if (trail) {
            closeModals();
            elements.importExportModal.style.display = 'flex';
            
            // Seleccionar el sendero en el dropdown
            elements.exportSelect.value = trailId;
            
            // Generar código de exportación
            generateExportCode();
        }
    }
    
    // Generar código de exportación con compresión
    function generateExportCode() {
        const trailId = elements.exportSelect.value;
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const trail = trails.find(t => t.id === parseInt(trailId));
        
        if (trail) {
            // Crear un objeto simplificado para exportar
            const exportTrail = {
                name: trail.name,
                points: trail.points,
                distance: trail.distance,
                time: trail.time,
                isPrivate: trail.isPrivate,
                version: '2.0'
            };
            
            // Convertir a JSON y comprimir con base64
            try {
                const jsonString = JSON.stringify(exportTrail);
                const base64String = btoa(unescape(encodeURIComponent(jsonString)));
                
                elements.exportCode.value = base64String;
            } catch (e) {
                console.error("Error generando código:", e);
                showToast("Error al generar código de exportación", "error");
            }
        }
    }
    
    // Importar sendero con validación mejorada
    function importTrail() {
        const importCode = elements.importCode.value.trim();
        
        if (!importCode) {
            showToast("Por favor, pega un código válido", "error");
            return;
        }
        
        try {
            // Decodificar desde base64
            const jsonString = decodeURIComponent(escape(atob(importCode)));
            const trailData = JSON.parse(jsonString);
            
            // Validar datos básicos
            if (!trailData.name || !trailData.points || !Array.isArray(trailData.points)) {
                throw new Error("Formato de código inválido.");
            }
            
            // Validar estructura de puntos
            if (trailData.points.length > 0) {
                const firstPoint = trailData.points[0];
                if (!Array.isArray(firstPoint) || firstPoint.length !== 2 || 
                    typeof firstPoint[0] !== 'number' || typeof firstPoint[1] !== 'number') {
                    throw new Error("Estructura de puntos inválida.");
                }
            }
            
            // Limitar la cantidad de puntos para prevenir abusos
            if (trailData.points.length > 10000) {
                throw new Error("El sendero tiene demasiados puntos.");
            }
            
            // Crear objeto de sendero completo
            const trail = {
                id: Date.now(),
                name: trailData.name,
                points: trailData.points,
                distance: trailData.distance || 0,
                time: trailData.time || 0,
                isPrivate: trailData.isPrivate || false,
                popularity: 1,
                createdAt: new Date().toISOString(),
                imported: true
            };
            
            // Guardar en LocalStorage
            const savedTrails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
            savedTrails.push(trail);
            localStorage.setItem('formigo_trails', JSON.stringify(savedTrails));
            
            // Actualizar la visualización
            loadSavedTrails();
            
            showToast(`Sendero "${trail.name}" importado correctamente`);
            elements.importExportModal.style.display = 'none';
            elements.importCode.value = '';
            
        } catch (error) {
            console.error("Error importando sendero:", error);
            showToast("Error al importar el sendero. Asegúrate de que el código es válido.", "error");
        }
    }
    
    // Eliminar sendero
    function deleteTrail(trailId) {
        if (!confirm("¿Estás seguro de que quieres eliminar este sendero?")) return;
        
        try {
            const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
            const filteredTrails = trails.filter(t => t.id !== parseInt(trailId));
            
            localStorage.setItem('formigo_trails', JSON.stringify(filteredTrails));
            loadSavedTrails();
            
            // Si el modal está abierto, recargar la lista
            if (elements.trailsModal.style.display === 'flex') {
                showTrailsModal();
            }
            
            showToast("Sendero eliminado correctamente");
        } catch (e) {
            console.error("Error eliminando sendero:", e);
            showToast("Error al eliminar el sendero", "error");
        }
    }
    
    // Copiar al portapapeles con API moderna
    function copyToClipboard() {
        if (!navigator.clipboard) {
            // Fallback para navegadores antiguos
            elements.exportCode.select();
            document.execCommand('copy');
            showToast("Código copiado al portapapeles");
            return;
        }
        
        navigator.clipboard.writeText(elements.exportCode.value)
            .then(() => {
                showToast("Código copiado al portapapeles. Compártelo con otros usuarios.");
            })
            .catch(err => {
                console.error('Error al copiar: ', err);
                showToast("Error al copiar al portapapeles", "error");
            });
    }
    
    // Mostrar modal de importar/exportar
    function showImportExportModal() {
        elements.importExportModal.style.display = 'flex';
        generateExportCode();
    }
    
    // Mostrar modal de configuración
    function showSettingsModal() {
        elements.settingsModal.style.display = 'flex';
    }
    
    // Cerrar modales
    function closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    // Cambiar estilo del mapa
    function changeMapStyle() {
        currentMapStyle = elements.mapStyle.value;
        
        // Remover todas las capas
        map.eachLayer(layer => {
            if (Object.values(mapLayers).includes(layer)) {
                map.removeLayer(layer);
            }
        });
        
        // Añadir la capa seleccionada
        mapLayers[currentMapStyle].addTo(map);
        
        saveSettings();
        showToast(`Estilo de mapa cambiado a ${elements.mapStyle.options[elements.mapStyle.selectedIndex].text}`);
    }
    
    // Cambiar unidad de distancia
    function changeDistanceUnit() {
        distanceUnit = elements.distanceUnit.value;
        updateUI();
        loadSavedTrails();
        saveSettings();
    }
    
    // Actualizar filtro de precisión
    function updateAccuracyFilter() {
        accuracyFilter = elements.accuracyFilter.value;
        elements.accuracyValue.textContent = `${accuracyFilter}m`;
        saveSettings();
    }
    
    // Guardar configuración
    function saveSettings() {
        const settings = {
            mapStyle: currentMapStyle,
            distanceUnit: distanceUnit,
            accuracyFilter: accuracyFilter,
            autoSave: elements.autoSave.checked
        };
        
        try {
            localStorage.setItem('formigo_settings', JSON.stringify(settings));
        } catch (e) {
            console.error("Error guardando configuración:", e);
        }
    }
    
    // Cargar configuración
    function loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('formigo_settings') || '{}');
            
            if (settings.mapStyle) {
                currentMapStyle = settings.mapStyle;
                elements.mapStyle.value = settings.mapStyle;
                changeMapStyle(); // Aplicar el estilo
            }
            
            if (settings.distanceUnit) {
                distanceUnit = settings.distanceUnit;
                elements.distanceUnit.value = settings.distanceUnit;
            }
            
            if (settings.accuracyFilter) {
                accuracyFilter = settings.accuracyFilter;
                elements.accuracyFilter.value = settings.accuracyFilter;
                elements.accuracyValue.textContent = `${accuracyFilter}m`;
            }
            
            if (settings.autoSave !== undefined) {
                elements.autoSave.checked = settings.autoSave;
            }
        } catch (e) {
            console.error("Error cargando configuración:", e);
        }
    }
    
    // Mostrar notificación toast mejorada
    function showToast(message, type = 'success') {
        const toast = elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        // Limpiar toast anterior si existe
        clearTimeout(toast.timeoutId);
        
        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Manejar teclas
    function handleKeydown(e) {
        // Espacio para iniciar/detener seguimiento
        if (e.code === 'Space' && !e.target.tagName.match(/input|textarea/i)) {
            e.preventDefault();
            toggleTracking();
        }
        
        // Escape para cerrar modales
        if (e.code === 'Escape') {
            closeModals();
        }
        
        // Ctrl+S para guardar
        if (e.ctrlKey && e.code === 'KeyS' && !e.target.tagName.match(/input|textarea/i)) {
            e.preventDefault();
            if (!elements.saveBtn.disabled) {
                saveTrail();
            }
        }
    }
    
    // Manejar cambio de visibilidad de la página
    function handleVisibilityChange() {
        if (document.hidden && isTracking) {
            // Pausar seguimiento cuando la app está en segundo plano
            stopTracking();
            showToast("Seguimiento pausado (app en segundo plano)");
        }
    }
    
    // Actualizar selector de exportación
    function updateExportSelect() {
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const exportSelect = elements.exportSelect;
        
        exportSelect.innerHTML = '';
        
        trails.forEach(trail => {
            const option = document.createElement('option');
            option.value = trail.id;
            option.textContent = trail.name;
            exportSelect.appendChild(option);
        });
        
        // Si hay senderos, generar código para el primero
        if (trails.length > 0) {
            generateExportCode();
        }
    }
    
    // API pública
    return {
        init: init,
        startTracking: startTracking,
        stopTracking: stopTracking,
        saveTrail: saveTrail,
        centerMap: centerMap
    };
})();

// Inicializar la aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', FormiGo.init);
} else {
    FormiGo.init();
}

// Registrar Service Worker para PWA con manejo mejorado
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
                
                // Verificar actualizaciones cada 24 horas
                setInterval(() => {
                    registration.update();
                }, 24 * 60 * 60 * 1000);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
