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
            attribution: '&copy; OpenStreetMap contributors'
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri'
        }),
        terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenTopoMap'
        })
    };
    
    // Inicializar la aplicación
    function init() {
        initMap();
        initEventListeners();
        loadSettings();
        loadSavedTrails();
        updateUI();
        
        // Solicitar permisos de geolocalización
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    map.setView([latitude, longitude], 16);
                },
                error => {
                    console.error("Error obteniendo ubicación: ", error);
                    showToast("No se pudo obtener tu ubicación. Asegúrate de tener el GPS activado.", "error");
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
        
        // Registrar el Service Worker para PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }
    
    // Inicializar el mapa
    function initMap() {
        map = L.map('map', {
            zoomControl: false,
            preferCanvas: true // Mejor rendimiento para muchos puntos
        }).setView([40.7128, -74.0060], 14);
        
        // Añadir capa por defecto
        mapLayers.standard.addTo(map);
        
        // Añadir control de zoom
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);
        
        // Inicializar la ruta del usuario
        userTrail = L.polyline([], {
            color: '#3498db',
            weight: 6,
            opacity: 0.8,
            smoothFactor: 1.0 // Mejor rendimiento
        }).addTo(map);
    }
    
    // Inicializar event listeners
    function initEventListeners() {
        // Botones principales
        elements.trackingBtn.addEventListener('click', toggleTracking);
        elements.saveBtn.addEventListener('click', saveTrail);
        elements.centerBtn.addEventListener('click', centerMap);
        
        // Navegación
        elements.myTrailsBtn.addEventListener('click', showTrailsModal);
        elements.importExportBtn.addEventListener('click', showImportExportModal);
        elements.settingsBtn.addEventListener('click', showSettingsModal);
        
        // Modales
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', closeModals);
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
    }
    
    // Alternar seguimiento
    function toggleTracking() {
        if (isTracking) {
            stopTracking();
        } else {
            startTracking();
        }
    }
    
    // Iniciar seguimiento
    function startTracking() {
        if (isTracking) return;
        
        isTracking = true;
        trackingStartTime = new Date();
        startTimer();
        
        elements.trackingBtn.innerHTML = '<i class="fas fa-stop"></i> <span class="btn-text">Detener</span>';
        elements.trackingBtn.className = 'button stop-btn';
        elements.status.textContent = 'Registrando tu ruta...';
        
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                position => handlePositionUpdate(position),
                error => handlePositionError(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 2000,
                    distanceFilter: 5 // Solo actualizar después de moverse 5 metros
                }
            );
        }
        
        // Optimización: pausar animaciones del mapa durante el seguimiento
        map._container.classList.add('tracking-active');
    }
    
    // Manejar actualización de posición
    function handlePositionUpdate(position) {
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
            userMarker = L.marker([latitude, longitude]).addTo(map)
                .bindPopup('¡Estás aquí!')
                .openPopup();
        }
        
        // Añadir punto al sendero
        trailPoints.push([latitude, longitude]);
        userTrail.setLatLngs(trailPoints);
        
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
    
    // Manejar error de posición
    function handlePositionError(error) {
        console.error("Error en seguimiento: ", error);
        elements.status.textContent = 'Error en el GPS. Verifica tu conexión.';
        showToast("Error en la señal GPS", "error");
    }
    
    // Detener seguimiento
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
    }
    
    // Iniciar temporizador
    function startTimer() {
        clearInterval(trackingInterval);
        trackingInterval = setInterval(updateTimer, 1000);
    }
    
    // Actualizar temporizador
    function updateTimer() {
        const now = new Date();
        const elapsed = new Date(now - trackingStartTime);
        
        const hours = elapsed.getUTCHours().toString().padStart(2, '0');
        const minutes = elapsed.getUTCMinutes().toString().padStart(2, '0');
        const seconds = elapsed.getUTCSeconds().toString().padStart(2, '0');
        
        elements.trailTime.textContent = `${hours}:${minutes}:${seconds}`;
    }
    
    // Detener temporizador
    function stopTimer() {
        clearInterval(trackingInterval);
    }
    
    // Centrar mapa en la ubicación actual
    function centerMap() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    map.setView([latitude, longitude], 16);
                    showToast("Mapa centrado en tu ubicación");
                },
                error => {
                    console.error("Error centrando mapa: ", error);
                    showToast("No se pudo obtener tu ubicación", "error");
                }
            );
        }
    }
    
    // Calcular distancia entre dos puntos
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
    
    // Actualizar interfaz de usuario
    function updateUI() {
        elements.trailLength.textContent = trailPoints.length;
        
        const displayDistance = distanceUnit === 'km' ? 
            totalDistance.toFixed(2) : (totalDistance * 0.621371).toFixed(2);
        elements.trailDistance.textContent = displayDistance;
        
        elements.saveBtn.disabled = trailPoints.length === 0;
    }
    
    // Guardar sendero
    function saveTrail() {
        if (trailPoints.length === 0) return;
        
        const trailName = prompt("Nombre de tu sendero:");
        if (!trailName) return;
        
        const isPrivate = elements.privacyToggle.checked;
        const elapsed = new Date(new Date() - trackingStartTime);
        
        const trail = {
            id: Date.now(),
            name: trailName,
            points: [...trailPoints],
            distance: totalDistance,
            time: elapsed.getTime(),
            isPrivate: isPrivate,
            popularity: 1,
            createdAt: new Date().toISOString()
        };
        
        // Guardar en LocalStorage
        const savedTrails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        savedTrails.push(trail);
        localStorage.setItem('formigo_trails', JSON.stringify(savedTrails));
        
        showToast(`Sendero "${trailName}" guardado correctamente`);
        resetTracking();
        loadSavedTrails();
    }
    
    // Cargar senderos guardados
    function loadSavedTrails() {
        const savedTrails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        
        // Limpiar senderos existentes en el mapa (excepto el actual)
        map.eachLayer(layer => {
            if (layer instanceof L.Polyline && layer !== userTrail && layer._antTrail) {
                map.removeLayer(layer);
            }
        });
        
        // Añadir senderos guardados al mapa
        savedTrails.forEach(trail => {
            const colorIntensity = Math.min(255, 50 + trail.popularity * 20);
            const trailColor = `rgb(50, ${100 + trail.popularity * 5}, 50)`;
            
            const polyline = L.polyline(trail.points, {
                color: trailColor,
                weight: 3 + (trail.popularity / 5),
                opacity: 0.7
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
    }
    
    // Reiniciar seguimiento
    function resetTracking() {
        trailPoints = [];
        totalDistance = 0;
        lastPoint = null;
        userTrail.setLatLngs([]);
        elements.trailTime.textContent = '00:00:00';
        updateUI();
    }
    
    // Mostrar modal de senderos
    function showTrailsModal() {
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const trailsList = elements.trailsList;
        
        trailsList.innerHTML = '';
        
        if (trails.length === 0) {
            trailsList.innerHTML = '<p class="no-trails">No tienes senderos guardados.</p>';
            elements.trailsModal.style.display = 'flex';
            return;
        }
        
        trails.forEach(trail => {
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
        
        // Añadir event listeners a los botones
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => viewTrail(btn.dataset.id));
        });
        
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', () => prepareExport(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteTrail(btn.dataset.id));
        });
        
        elements.trailsModal.style.display = 'flex';
    }
    
    // Ver sendero en el mapa
    function viewTrail(trailId) {
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const trail = trails.find(t => t.id === parseInt(trailId));
        
        if (trail) {
            // Ajustar la vista del mapa para mostrar el sendero completo
            const bounds = L.latLngBounds(trail.points);
            map.fitBounds(bounds, { padding: [50, 50] });
            
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
    
    // Generar código de exportación
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
                version: '1.0'
            };
            
            // Convertir a JSON y comprimir con base64
            const jsonString = JSON.stringify(exportTrail);
            const base64String = btoa(unescape(encodeURIComponent(jsonString)));
            
            elements.exportCode.value = base64String;
        }
    }
    
    // Importar sendero
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
        
        const trails = JSON.parse(localStorage.getItem('formigo_trails') || '[]');
        const filteredTrails = trails.filter(t => t.id !== parseInt(trailId));
        
        localStorage.setItem('formigo_trails', JSON.stringify(filteredTrails));
        loadSavedTrails();
        
        // Si el modal está abierto, recargar la lista
        if (elements.trailsModal.style.display === 'flex') {
            showTrailsModal();
        }
        
        showToast("Sendero eliminado correctamente");
    }
    
    // Copiar al portapapeles
    function copyToClipboard() {
        elements.exportCode.select();
        document.execCommand('copy');
        
        showToast("Código copiado al portapapeles. Compártelo con otros usuarios.");
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
        
        localStorage.setItem('formigo_settings', JSON.stringify(settings));
    }
    
    // Cargar configuración
    function loadSettings() {
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
    }
    
    // Mostrar notificación toast
    function showToast(message, type = 'success') {
        const toast = elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
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
document.addEventListener('DOMContentLoaded', FormiGo.init);

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
