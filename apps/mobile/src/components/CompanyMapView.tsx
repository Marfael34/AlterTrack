import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/colors';
import { FilterStorageService } from '../services/filterStorage.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { Company, STATUS_LABELS } from '../types/company';
import { StatusBadge } from './StatusBadge';

interface CompanyMapViewProps {
  companies: Company[];
  refPoint: ReferencePoint | null;
  distancesMap: Record<string, number>;
  onSelectCompany: (company: Company) => void;
  onOpenRefPointModal: () => void;
}

type DistanceFilter = 'ALL' | 15 | 30 | 50;

export const CompanyMapView: React.FC<CompanyMapViewProps> = ({
  companies,
  refPoint,
  distancesMap,
  onSelectCompany,
  onOpenRefPointModal,
}) => {
  const webViewRef = useRef<any>(null);
  const savedMapFilters = FilterStorageService.getFiltersSync();
  const [activeTab, setActiveTab] = useState<'RADAR' | 'MAP'>(
    savedMapFilters.mapTab || 'RADAR',
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [maxRadius, setMaxRadius] = useState<DistanceFilter>(
    savedMapFilters.maxRadius || 'ALL',
  );
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // Mémoriser l'onglet sélectionné et le rayon dans le service de filtres
  useEffect(() => {
    FilterStorageService.saveFilters({
      mapTab: activeTab,
      maxRadius,
    });
  }, [activeTab, maxRadius]);

  // Masquer l'overlay après 2.5s maximum
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Filtrer les entreprises géolocalisées
  const geolocatedCompanies = useMemo(() => {
    return companies.filter(
      (c) =>
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !isNaN(c.latitude) &&
        !isNaN(c.longitude),
    );
  }, [companies]);

  // Entreprises triées par distance par rapport au point fixe
  const sortedByDistance = useMemo(() => {
    return [...companies].sort((a, b) => {
      const distA = distancesMap[a.id] !== undefined ? distancesMap[a.id] : 999999;
      const distB = distancesMap[b.id] !== undefined ? distancesMap[b.id] : 999999;
      return distA - distB;
    });
  }, [companies, distancesMap]);

  // Filtrées selon le rayon sélectionné
  const filteredByRadius = useMemo(() => {
    if (maxRadius === 'ALL') return sortedByDistance;
    return sortedByDistance.filter((c) => {
      const d = distancesMap[c.id];
      return d !== undefined && d <= maxRadius;
    });
  }, [sortedByDistance, maxRadius, distancesMap]);

  // Groupées en zones concentriques pour le mode Radar
  const radarGroups = useMemo(() => {
    const zone0_15: Company[] = [];
    const zone15_30: Company[] = [];
    const zone30_50: Company[] = [];
    const zone50_plus: Company[] = [];
    const zoneUnknown: Company[] = [];

    filteredByRadius.forEach((comp) => {
      const dist = distancesMap[comp.id];
      if (dist === undefined) {
        zoneUnknown.push(comp);
      } else if (dist <= 15) {
        zone0_15.push(comp);
      } else if (dist <= 30) {
        zone15_30.push(comp);
      } else if (dist <= 50) {
        zone30_50.push(comp);
      } else {
        zone50_plus.push(comp);
      }
    });

    return [
      {
        id: 'z1',
        title: '🎯 Zone Immédiate (< 15 km)',
        badgeColor: '#00F099',
        companies: zone0_15,
      },
      {
        id: 'z2',
        title: '🚗 Zone Proche (15 à 30 km)',
        badgeColor: '#00D2C4',
        companies: zone15_30,
      },
      {
        id: 'z3',
        title: '🛣️ Zone Moyenne (30 à 50 km)',
        badgeColor: '#0066FF',
        companies: zone30_50,
      },
      {
        id: 'z4',
        title: '🚆 Au-delà de 50 km',
        badgeColor: '#F59E0B',
        companies: zone50_plus,
      },
      ...(zoneUnknown.length > 0 && maxRadius === 'ALL'
        ? [
            {
              id: 'z0',
              title: '📍 Distance non calculable (adresse à préciser)',
              badgeColor: Colors.textMuted,
              companies: zoneUnknown,
            },
          ]
        : []),
    ];
  }, [filteredByRadius, distancesMap, maxRadius]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Ouvrir l'application de navigation GPS native du smartphone (Google Maps / Waze) sans aucune clé API
  const handleOpenGpsNavigation = (lat?: number | null, lng?: number | null, name?: string) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      Alert.alert('Coordonnées manquantes', 'Cette entreprise n\'a pas d\'adresse GPS valide.');
      return;
    }
    const label = encodeURIComponent(name || 'Entreprise');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application GPS.');
    });
  };

  // Données sérialisées pour la vue Leaflet 2D (100% sans clé API)
  const mapDataJson = useMemo(() => {
    const payload = {
      refPoint: refPoint
        ? {
            label: refPoint.label,
            latitude: refPoint.latitude,
            longitude: refPoint.longitude,
            isGps: !!refPoint.isGps,
          }
        : null,
      companies: geolocatedCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city || '',
        address: c.address || '',
        status: c.status,
        statusLabel: STATUS_LABELS[c.status] || c.status,
        latitude: c.latitude,
        longitude: c.longitude,
        distance: distancesMap[c.id] !== undefined ? distancesMap[c.id] : null,
        distanceText: LocationService.formatDistance(distancesMap[c.id]) || '',
        color: Colors.status[c.status] || Colors.primary,
      })),
      accentColor: Colors.accent,
      primaryColor: Colors.primary,
    };
    return JSON.stringify(payload);
  }, [geolocatedCompanies, refPoint, distancesMap]);

  // HTML autonome Leaflet en mode Satellite avec noms des villes (ESRI World Imagery + World Boundaries & Places)
  const htmlContent = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>AlterTrack Satellite Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    .leaflet-container { background: #0B0F19 !important; }
    .pin-home {
      display: flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; background: #00D2C4; border: 3px solid #FFFFFF;
      border-radius: 50%; box-shadow: 0 4px 12px rgba(0, 210, 196, 0.6);
      color: #FFFFFF; font-size: 18px;
    }
    .pin-company {
      position: relative;
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%; border: 2px solid #FFFFFF;
      color: #FFFFFF; font-weight: bold; font-size: 13px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5); cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .pin-company:hover, .pin-company:active {
      transform: scale(1.2);
      z-index: 999;
    }
    .pin-badge {
      position: absolute;
      top: -6px;
      right: -8px;
      background: #00D2C4;
      color: #0B0F19;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 8px;
      border: 1px solid #FFFFFF;
      line-height: 11px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    }
    .popup-commune-info {
      font-size: 11px;
      color: #00D2C4;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .leaflet-popup-content-wrapper {
      background: #131B2E !important; color: #FFFFFF !important;
      border: 1px solid #00D2C4; border-radius: 12px !important;
      padding: 4px; box-shadow: 0 6px 18px rgba(0,0,0,0.6) !important;
    }
    .leaflet-popup-tip { background: #131B2E !important; }
    .popup-title { font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 2px; }
    .popup-sub { font-size: 11px; color: #A7A9BE; margin-bottom: 6px; }
    .popup-dist { font-size: 11px; font-weight: 700; color: #00D2C4; display: inline-block; margin-bottom: 6px; }
    .popup-btn {
      display: block; background: #0066FF; color: #FFFFFF; text-align: center;
      padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
      text-decoration: none; margin-top: 4px;
    }

    /* Style du badge de ville au centre des regroupements d'entreprises */
    .city-cluster-pill {
      background: rgba(11, 15, 25, 0.90);
      border: 1.5px solid #00D2C4;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.7);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      pointer-events: none;
    }
    .city-count {
      background: #00D2C4;
      color: #0B0F19;
      font-size: 10px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 8px;
    }

    /* Nom de l'entreprise affiché sous chaque bulle */
    .custom-company-tooltip {
      background: rgba(11, 15, 25, 0.92) !important;
      border: 1px solid rgba(0, 210, 196, 0.75) !important;
      color: #FFFFFF !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      padding: 2px 6px !important;
      box-shadow: 0 3px 8px rgba(0,0,0,0.7) !important;
      max-width: 135px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      text-align: center !important;
      pointer-events: none !important;
    }
    .custom-company-tooltip::before {
      border-bottom-color: rgba(11, 15, 25, 0.92) !important;
    }
    .pin-company-tip {
      color: #FFFFFF;
      font-weight: 700;
    }

    /* Contrôles Leaflet intégrés au thème sombre */
    .leaflet-control-layers {
      background: rgba(19, 27, 46, 0.92) !important;
      border: 1px solid #00D2C4 !important;
      border-radius: 10px !important;
      color: #FFFFFF !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.6) !important;
      padding: 6px 10px !important;
      font-size: 12px !important;
    }
    .leaflet-control-layers-toggle {
      background-color: rgba(19, 27, 46, 0.92) !important;
      border-radius: 8px !important;
      border: 1px solid #00D2C4 !important;
      width: 34px !important;
      height: 34px !important;
      background-size: 20px 20px !important;
    }
    .leaflet-control-zoom a {
      background: rgba(19, 27, 46, 0.9) !important;
      color: #00D2C4 !important;
      border-color: rgba(0, 210, 196, 0.3) !important;
    }
    .leaflet-control-zoom a:hover {
      background: #1E293B !important;
      color: #FFFFFF !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var mapInstance = null;
    var markersGroup = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function initMap() {
      if (typeof L === 'undefined' || typeof L.map !== 'function') {
        setTimeout(initMap, 80);
        return;
      }
      if (mapInstance) return;

      try {
        var data = ${mapDataJson};
        mapInstance = L.map('map', { zoomControl: false, attributionControl: false });
        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

        // Créer un panneau dédié pour les noms des villes au-dessus des photos satellites
        mapInstance.createPane('labelsPane');
        mapInstance.getPane('labelsPane').style.zIndex = '350';
        mapInstance.getPane('labelsPane').style.pointerEvents = 'none';

        // 1. Couche Satellite Haute Définition (ESRI World Imagery)
        var satLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: 'Esri, Maxar'
        });

        // 2. Couche Noms des Villes, Communes et Frontières (ESRI Reference World Boundaries & Places)
        var placesLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          pane: 'labelsPane'
        });

        // 3. Couche Réseau Routier (ESRI World Transportation)
        var roadsLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          opacity: 0.55,
          pane: 'labelsPane'
        });

        // 4. Couche Plan classique OpenStreetMap (Alternative disponible)
        var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        });

        // Groupe Hybride Satellite + Villes (Actif par défaut)
        var hybridGroup = L.layerGroup([satLayer, roadsLayer, placesLayer]).addTo(mapInstance);

        // Sélecteur de couches Leaflet en haut à droite
        var pureSatLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: 'Esri, Maxar'
        });

        var baseMaps = {
          "🛰️ Satellite + Villes": hybridGroup,
          "🛰️ Satellite pur": pureSatLayer,
          "🗺️ Plan standard": osmLayer
        };
        L.control.layers(baseMaps, null, { position: 'topright' }).addTo(mapInstance);

        // Secours si tuiles indisponibles
        satLayer.on('tileerror', function() {
          if (!mapInstance._osmFallback) {
            mapInstance._osmFallback = true;
            osmLayer.addTo(mapInstance);
          }
        });

        markersGroup = L.featureGroup().addTo(mapInstance);

        if (data.refPoint) {
          var homeIcon = L.divIcon({
            className: 'custom-icon',
            html: '<div class="pin-home">' + (data.refPoint.isGps ? '🎯' : '🏠') + '</div>',
            iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -20]
          });
          var homeMarker = L.marker([data.refPoint.latitude, data.refPoint.longitude], { icon: homeIcon, zIndexOffset: 1000 }).addTo(markersGroup);
          homeMarker.bindPopup('<div class="popup-title">' + (data.refPoint.isGps ? 'Position GPS' : 'Mon adresse fixe') + '</div><div class="popup-sub">' + data.refPoint.label + '</div>');

          // Cercles 15km et 30km
          L.circle([data.refPoint.latitude, data.refPoint.longitude], { radius: 15000, color: '#00D2C4', weight: 1.5, fillColor: '#00D2C4', fillOpacity: 0.06, dashArray: '5, 8' }).addTo(mapInstance);
          L.circle([data.refPoint.latitude, data.refPoint.longitude], { radius: 30000, color: '#0066FF', weight: 1.5, fillColor: '#0066FF', fillOpacity: 0.04, dashArray: '4, 10' }).addTo(mapInstance);
        }

        // Détecter les entreprises partageant les mêmes coordonnées (ex: même commune sans numéro de rue)
        var coordGroups = {};
        data.companies.forEach(function(comp) {
          var key = comp.latitude.toFixed(4) + '_' + comp.longitude.toFixed(4);
          if (!coordGroups[key]) coordGroups[key] = [];
          coordGroups[key].push(comp);
        });

        // Afficher chaque marqueur avec décalage circulaire élégant si superposés
        Object.keys(coordGroups).forEach(function(key) {
          var group = coordGroups[key];
          var total = group.length;
          var cityName = group[0].city || '';

          if (total > 1) {
            var centerLat = group[0].latitude;
            var centerLng = group[0].longitude;

            // Point central discret de la commune
            L.circleMarker([centerLat, centerLng], {
              radius: 6,
              color: '#00D2C4',
              fillColor: '#00D2C4',
              fillOpacity: 0.9,
              weight: 2
            }).addTo(mapInstance);

            // Badge avec le nom de la ville au centre du cluster
            if (cityName) {
              var cityLabelIcon = L.divIcon({
                className: 'city-cluster-container',
                html: '<div class="city-cluster-pill">📍 ' + cityName + ' <span class="city-count">' + total + '</span></div>',
                iconSize: [120, 24],
                iconAnchor: [60, 12]
              });
              L.marker([centerLat, centerLng], { icon: cityLabelIcon, interactive: false, zIndexOffset: 200 }).addTo(mapInstance);
            }
          }

          group.forEach(function(comp, idx) {
            var markerLat = comp.latitude;
            var markerLng = comp.longitude;

            if (total > 1) {
              // Disperser en rosace / cercle élégant (~200m à 350m)
              var angle = (2 * Math.PI * idx) / total - (Math.PI / 2);
              var radius = total > 5 ? 0.0036 : 0.0024;
              markerLat = comp.latitude + radius * Math.cos(angle);
              markerLng = comp.longitude + (radius * 1.35) * Math.sin(angle);

              // Ligne fine en pointillé reliant l'entreprise au centre de la commune
              L.polyline([[comp.latitude, comp.longitude], [markerLat, markerLng]], {
                color: '#00D2C4',
                weight: 1.5,
                opacity: 0.6,
                dashArray: '3, 4'
              }).addTo(mapInstance);
            }

            var icon = L.divIcon({
              className: 'custom-icon',
              html: '<div class="pin-company" id="pin-' + comp.id + '" style="background:' + comp.color + '">' +
                '🏢' +
                (total > 1 ? '<span class="pin-badge">' + (idx + 1) + '/' + total + '</span>' : '') +
                '</div>',
              iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18]
            });

            var marker = L.marker([markerLat, markerLng], { icon: icon }).addTo(markersGroup);

            // Afficher le nom de l'entreprise sous la bulle
            var compNameSafe = escapeHtml(comp.name);
            marker.bindTooltip('<span class="pin-company-tip">' + compNameSafe + '</span>', {
              permanent: true,
              direction: 'bottom',
              offset: [0, 8],
              className: 'custom-company-tooltip'
            });

            var popupHtml = '<div class="popup-title">' + comp.name + '</div>';
            if (comp.city || comp.address) popupHtml += '<div class="popup-sub">' + (comp.address ? comp.address + ' • ' : '') + comp.city + '</div>';
            if (total > 1) popupHtml += '<div class="popup-commune-info">📍 Entreprise ' + (idx + 1) + ' sur ' + total + ' à ' + (comp.city || 'cette commune') + '</div>';
            if (comp.distanceText) popupHtml += '<div class="popup-dist">🧭 ' + comp.distanceText + '</div>';
            popupHtml += '<a class="popup-btn" href="javascript:void(0)" onclick="selectCompany(\\'' + comp.id + '\\')">Ouvrir la fiche</a>';
            marker.bindPopup(popupHtml);

            marker.on('click', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_PIN', companyId: comp.id }));
              }
            });
          });
        });

        if (markersGroup.getLayers().length > 0) {
          mapInstance.fitBounds(markersGroup.getBounds(), { padding: [40, 40], maxZoom: 13 });
        } else if (data.refPoint) {
          mapInstance.setView([data.refPoint.latitude, data.refPoint.longitude], 11);
        } else {
          mapInstance.setView([46.603354, 1.888334], 6);
        }

        setTimeout(function() { if (mapInstance) mapInstance.invalidateSize(); }, 300);
        setTimeout(function() { if (mapInstance) mapInstance.invalidateSize(); }, 800);

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      } catch (err) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      }
    }

    function selectCompany(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_COMPANY', companyId: id }));
      }
    }

    window.centerOnHome = function() {
      var data = ${mapDataJson};
      if (mapInstance && data.refPoint) {
        mapInstance.setView([data.refPoint.latitude, data.refPoint.longitude], 12, { animate: true });
      }
    };

    window.fitAll = function() {
      if (mapInstance && markersGroup && markersGroup.getLayers().length > 0) {
        mapInstance.fitBounds(markersGroup.getBounds(), { padding: [40, 40], maxZoom: 13 });
      }
    };

    function loadScript(src, fallbackSrc, done) {
      var s = document.createElement('script');
      s.src = src; s.onload = done;
      s.onerror = function() { if (fallbackSrc) loadScript(fallbackSrc, null, done); };
      document.head.appendChild(s);
    }

    loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js', initMap);
  </script>
</body>
</html>`;
  }, [mapDataJson]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        companyId?: string;
      };
      if (data.type === 'MAP_READY') {
        setIsMapReady(true);
      } else if (data.type === 'SELECT_PIN' && data.companyId) {
        setSelectedCompanyId(data.companyId);
      } else if (data.type === 'OPEN_COMPANY' && data.companyId) {
        const found = companies.find((c) => c.id === data.companyId);
        if (found) {
          onSelectCompany(found);
        }
      }
    } catch {
      // Ignore
    }
  };

  return (
    <View style={styles.container}>
      {/* Sélecteur de mode : Radar Natif (Sans clé API) OU Carte 2D */}
      <View style={styles.subModeSegment}>
        <TouchableOpacity
          style={[styles.subModeTab, activeTab === 'RADAR' && styles.subModeTabActive]}
          onPress={() => setActiveTab('RADAR')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="compass"
            size={14}
            color={activeTab === 'RADAR' ? Colors.accent : Colors.textSecondary}
          />
          <Text
            style={[
              styles.subModeTabText,
              activeTab === 'RADAR' && styles.subModeTabTextActive,
            ]}
          >
            🎯 Radar & Distances
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subModeTab, activeTab === 'MAP' && styles.subModeTabActive]}
          onPress={() => setActiveTab('MAP')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="earth"
            size={14}
            color={activeTab === 'MAP' ? Colors.primary : Colors.textSecondary}
          />
          <Text
            style={[
              styles.subModeTabText,
              activeTab === 'MAP' && styles.subModeTabTextActive,
            ]}
          >
            🛰️ Satellite & Villes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bannière adresse fixe si non définie */}
      {!refPoint && (
        <TouchableOpacity
          style={styles.noRefBanner}
          onPress={onOpenRefPointModal}
          activeOpacity={0.8}
        >
          <Ionicons name="location" size={15} color={Colors.accent} />
          <Text style={styles.noRefText}>
            Définissez votre adresse fixe pour calculer les distances autour de chez vous
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
        </TouchableOpacity>
      )}

      {/* ========================================================= */}
      {/* MODE 1 : RADAR PROXIMITÉ NATIF (100% SANS AUCUNE CLÉ API) */}
      {/* ========================================================= */}
      {activeTab === 'RADAR' ? (
        <ScrollView style={styles.radarScroll} contentContainerStyle={styles.radarContent}>
          {/* En-tête : Point de repère et filtre de rayon */}
          <View style={styles.radarHeaderCard}>
            <View style={styles.radarHeaderTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.radarTitle}>Rayon de prospection</Text>
                <Text style={styles.radarSubtitle}>
                  {refPoint
                    ? `Autour de : ${refPoint.label}`
                    : 'Adresse fixe non configurée'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editAddressBtn}
                onPress={onOpenRefPointModal}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={13} color={Colors.accent} />
                <Text style={styles.editAddressText}>Modifier</Text>
              </TouchableOpacity>
            </View>

            {/* Puces de filtres par rayon */}
            <View style={styles.radiusChipsRow}>
              {(['ALL', 15, 30, 50] as const).map((r) => {
                const isSelected = maxRadius === r;
                const label = r === 'ALL' ? 'Toutes distances' : `< ${r} km`;
                return (
                  <TouchableOpacity
                    key={String(r)}
                    style={[
                      styles.radiusChip,
                      isSelected && styles.radiusChipActive,
                    ]}
                    onPress={() => setMaxRadius(r)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.radiusChipText,
                        isSelected && styles.radiusChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Groupes de zones concentriques */}
          {radarGroups.map((group) => {
            if (group.companies.length === 0) return null;
            return (
              <View key={group.id} style={styles.zoneSection}>
                <View style={styles.zoneHeader}>
                  <View style={[styles.zoneDot, { backgroundColor: group.badgeColor }]} />
                  <Text style={styles.zoneTitle}>{group.title}</Text>
                  <View style={styles.zoneCountPill}>
                    <Text style={styles.zoneCountText}>{group.companies.length}</Text>
                  </View>
                </View>

                {group.companies.map((comp) => {
                  const dist = distancesMap[comp.id];
                  const formattedDist = LocationService.formatDistance(dist);

                  return (
                    <View key={comp.id} style={styles.radarCard}>
                      <View style={styles.radarCardHeader}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.radarCardName} numberOfLines={1}>
                            {comp.name}
                          </Text>
                          <Text style={styles.radarCardCity} numberOfLines={1}>
                            {comp.address ? `${comp.address} • ` : ''}
                            {comp.city || 'Ville non renseignée'}
                          </Text>
                        </View>
                        <StatusBadge status={comp.status} size="small" />
                      </View>

                      <View style={styles.radarCardFooter}>
                        {formattedDist ? (
                          <View style={styles.radarDistBadge}>
                            <Ionicons name="compass" size={13} color={Colors.accent} />
                            <Text style={styles.radarDistText}>{formattedDist}</Text>
                          </View>
                        ) : (
                          <View style={styles.radarDistBadge}>
                            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                            <Text style={[styles.radarDistText, { color: Colors.textMuted }]}>
                              Distance indéterminée
                            </Text>
                          </View>
                        )}

                        <View style={styles.radarActionsRow}>
                          {typeof comp.latitude === 'number' && typeof comp.longitude === 'number' && (
                            <TouchableOpacity
                              style={styles.gpsNavButton}
                              onPress={() =>
                                handleOpenGpsNavigation(comp.latitude, comp.longitude, comp.name)
                              }
                              activeOpacity={0.8}
                            >
                              <Ionicons name="navigate" size={13} color="#FFFFFF" />
                              <Text style={styles.gpsNavButtonText}>Itinéraire</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.viewSheetButton}
                            onPress={() => onSelectCompany(comp)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.viewSheetButtonText}>Fiche</Text>
                            <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          {filteredByRadius.length === 0 && (
            <View style={styles.emptyRadar}>
              <Ionicons name="compass-outline" size={42} color={Colors.textMuted} />
              <Text style={styles.emptyRadarTitle}>Aucune entreprise dans ce rayon</Text>
              <Text style={styles.emptyRadarSub}>
                Augmentez le filtre de distance pour afficher plus de résultats.
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* ========================================================= */
        /* MODE 2 : CARTE 2D LEAFLET (SANS AUCUNE CLÉ API REQUISE)   */
        /* ========================================================= */
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{
              html: htmlContent,
              baseUrl: 'https://unpkg.com',
            }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            onMessage={handleMessage}
            onLoadEnd={() => setIsMapReady(true)}
          />

          {!isMapReady && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Affichage de la carte...</Text>
            </View>
          )}

          {/* Boutons d'actions rapides sur la carte */}
          <View style={styles.mapFloatingControls}>
            <TouchableOpacity
              style={styles.mapCtrlBtn}
              onPress={() => webViewRef.current?.injectJavaScript('window.fitAll && window.fitAll(); true;')}
              activeOpacity={0.8}
            >
              <Ionicons name="scan-outline" size={14} color="#00D2C4" />
              <Text style={styles.mapCtrlText}>Tout voir</Text>
            </TouchableOpacity>

            {refPoint && (
              <TouchableOpacity
                style={styles.mapCtrlBtn}
                onPress={() => webViewRef.current?.injectJavaScript('window.centerOnHome && window.centerOnHome(); true;')}
                activeOpacity={0.8}
              >
                <Ionicons name="home" size={14} color="#00D2C4" />
                <Text style={styles.mapCtrlText}>Mon adresse</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Fiche flottante de l'entreprise cliquée */}
          {selectedCompany && (
            <View style={styles.floatingCard}>
              <View style={styles.floatingHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.floatingName} numberOfLines={1}>
                    {selectedCompany.name}
                  </Text>
                  <Text style={styles.floatingCity} numberOfLines={1}>
                    {selectedCompany.address
                      ? `${selectedCompany.address} • ${selectedCompany.city}`
                      : selectedCompany.city || 'Localisation'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeCardBtn}
                  onPress={() => setSelectedCompanyId(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.floatingBadgesRow}>
                <StatusBadge status={selectedCompany.status} size="small" />
                {distancesMap[selectedCompany.id] !== undefined && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="compass-outline" size={12} color={Colors.accent} />
                    <Text style={styles.distanceBadgeText}>
                      {LocationService.formatDistance(distancesMap[selectedCompany.id])}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.floatingButtonsRow}>
                {typeof selectedCompany.latitude === 'number' && (
                  <TouchableOpacity
                    style={styles.gpsFloatingBtn}
                    onPress={() =>
                      handleOpenGpsNavigation(
                        selectedCompany.latitude,
                        selectedCompany.longitude,
                        selectedCompany.name,
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons name="navigate" size={14} color="#FFFFFF" />
                    <Text style={styles.gpsFloatingBtnText}>GPS</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.openDetailsBtn}
                  onPress={() => onSelectCompany(selectedCompany)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.openDetailsText}>Consulter la fiche</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  subModeSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  subModeTabActive: {
    backgroundColor: `${Colors.primary}25`,
  },
  subModeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  subModeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  noRefBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}15`,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
    gap: 8,
  },
  noRefText: {
    color: Colors.accent,
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  radarScroll: {
    flex: 1,
  },
  radarContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  radarHeaderCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  radarHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radarTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  radarSubtitle: {
    color: Colors.accent,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  editAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  editAddressText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  radiusChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  radiusChip: {
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  radiusChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radiusChipText: {
    color: Colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  zoneSection: {
    gap: 8,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  zoneCountPill: {
    backgroundColor: `${Colors.primary}25`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  zoneCountText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  radarCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  radarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  radarCardName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  radarCardCity: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  radarCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: `${Colors.border}80`,
    paddingTop: 8,
  },
  radarDistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  radarDistText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  radarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  gpsNavButtonText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  viewSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  viewSheetButtonText: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyRadar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyRadarTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyRadarSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  floatingCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}50`,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
    gap: 10,
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  floatingName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  floatingCity: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeCardBtn: {
    padding: 4,
  },
  floatingBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}20`,
    borderWidth: 1,
    borderColor: `${Colors.accent}50`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  distanceBadgeText: {
    color: Colors.accent,
    fontSize: 11.5,
    fontWeight: '700',
  },
  floatingButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  gpsFloatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandGreen,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  gpsFloatingBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  openDetailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  openDetailsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  mapFloatingControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  mapCtrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(19, 27, 46, 0.92)',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 196, 0.5)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  mapCtrlText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
