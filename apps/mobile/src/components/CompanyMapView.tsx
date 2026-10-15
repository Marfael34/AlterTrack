import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/colors';
import { FilterStorageService } from '../services/filterStorage.service';
import { LocationService, ReferencePoint } from '../services/location.service';
import { Company, CompanyStats, STATUS_LABELS, Status } from '../types/company';
import { StatusBadge } from './StatusBadge';

interface CompanyMapViewProps {
  companies: Company[];
  totalCount?: number;
  stats?: CompanyStats;
  selectedStatuses?: Status[];
  onToggleStatus?: (status: Status) => void;
  onSelectAllStatuses?: () => void;
  searchQuery?: string;
  onChangeSearchQuery?: (query: string) => void;
  activeFiltersCount?: number;
  onOpenFiltersModal?: () => void;
  refPoint: ReferencePoint | null;
  distancesMap: Record<string, number>;
  onSelectCompany: (company: Company) => void;
  onOpenRefPointModal: () => void;
}

type DistanceFilter = 'ALL' | 15 | 30 | 50;

const ALL_STATUS_KEYS: Status[] = [
  'TO_SEND',
  'WAITING_FOR_REPLY',
  'TO_FOLLOW_UP',
  'REPLY_RECEIVED',
  'TO_CALL',
  'ACCEPTED',
  'REFUSED',
];

export const CompanyMapView: React.FC<CompanyMapViewProps> = ({
  companies,
  totalCount = 0,
  stats,
  selectedStatuses = [],
  onToggleStatus,
  onSelectAllStatuses,
  searchQuery = '',
  onChangeSearchQuery,
  activeFiltersCount = 0,
  onOpenFiltersModal,
  refPoint,
  distancesMap,
  onSelectCompany,
  onOpenRefPointModal,
}) => {
  const webViewRef = useRef<any>(null);
  const savedMapFilters = FilterStorageService.getFiltersSync();
  // Par défaut, la carte satellite interactive prend tout l'écran
  const [activeTab, setActiveTab] = useState<'RADAR' | 'MAP'>(
    savedMapFilters.mapTab || 'MAP',
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

  // Masquer l'overlay après 2.2s maximum
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Filtrer les entreprises géolocalisées et selon le rayon sélectionné
  const geolocatedCompanies = useMemo(() => {
    return companies.filter(
      (c) =>
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !isNaN(c.latitude) &&
        !isNaN(c.longitude) &&
        (maxRadius === 'ALL' ||
          (distancesMap[c.id] !== undefined && distancesMap[c.id] <= maxRadius)),
    );
  }, [companies, maxRadius, distancesMap]);

  // Entreprises triées par distance par rapport au point fixe
  const sortedByDistance = useMemo(() => {
    return [...companies].sort((a, b) => {
      const distA = distancesMap[a.id] !== undefined ? distancesMap[a.id] : 999999;
      const distB = distancesMap[b.id] !== undefined ? distancesMap[b.id] : 999999;
      return distA - distB;
    });
  }, [companies, distancesMap]);

  // Filtrées selon le rayon sélectionné pour le mode liste Radar
  const filteredByRadius = useMemo(() => {
    if (maxRadius === 'ALL') return sortedByDistance;
    return sortedByDistance.filter((c) => {
      const d = distancesMap[c.id];
      return d !== undefined && d <= maxRadius;
    });
  }, [sortedByDistance, maxRadius, distancesMap]);

  // Groupées en zones concentriques pour le mode Radar liste
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

  // Ouvrir l'application de navigation GPS native du smartphone (Google Maps / Waze)
  const handleOpenGpsNavigation = (lat?: number | null, lng?: number | null, name?: string) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      Alert.alert('Coordonnées manquantes', "Cette entreprise n'a pas d'adresse GPS valide.");
      return;
    }
    const label = encodeURIComponent(name || 'Entreprise');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir l'application GPS.");
    });
  };

  // Données sérialisées pour la vue Leaflet (avec les pins SVG modernes)
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

  // Mise à jour fluide des marqueurs sans rechargement de page
  useEffect(() => {
    if (isMapReady && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.updateMapData) { window.updateMapData(${mapDataJson}); } true;`,
      );
    }
  }, [mapDataJson, isMapReady]);

  // HTML autonome Leaflet en mode Satellite avec pins modernes vectoriels
  const htmlContent = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>AlterTrack Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    .leaflet-container { background: #0B0F19 !important; }

    /* Conteneurs transparents pour les icônes personnalisées */
    .custom-pin-icon, .custom-home-pin-icon {
      background: transparent !important;
      border: none !important;
    }

    /* Style de la punaise 3D sphérique (pushpin avec tête ronde brillante et aiguille chromée) */
    .modern-pushpin, .home-pushpin {
      position: relative;
      width: 32px;
      height: 48px;
      cursor: pointer;
      transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      transform-origin: 16px 47px;
    }
    .modern-pushpin:hover, .modern-pushpin:active {
      transform: scale(1.25);
      z-index: 9999 !important;
    }
    .home-pushpin:hover, .home-pushpin:active {
      transform: scale(1.25);
      z-index: 10000 !important;
    }

    /* Badge numérique si plusieurs entreprises au même endroit */
    .pin-badge {
      position: absolute;
      top: -3px;
      right: -5px;
      background: #00D2C4;
      color: #0B0F19;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 9px;
      border: 1.5px solid #FFFFFF;
      line-height: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
      pointer-events: none;
    }

    /* Popups Leaflet au style AlterTrack */
    .leaflet-popup-content-wrapper {
      background: #131B2E !important; color: #FFFFFF !important;
      border: 1.5px solid #00D2C4; border-radius: 14px !important;
      padding: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.7) !important;
    }
    .leaflet-popup-tip { background: #131B2E !important; }
    .popup-title { font-size: 14px; font-weight: 800; color: #FFFFFF; margin-bottom: 2px; }
    .popup-sub { font-size: 11px; color: #A7A9BE; margin-bottom: 6px; }
    .popup-dist { font-size: 11px; font-weight: 700; color: #00D2C4; display: inline-block; margin-bottom: 6px; }
    .popup-btn {
      display: block; background: #0066FF; color: #FFFFFF; text-align: center;
      padding: 7px 10px; border-radius: 8px; font-size: 11px; font-weight: 700;
      text-decoration: none; margin-top: 6px;
    }

    /* Badge de commune au centre du cluster */
    .city-cluster-pill {
      background: rgba(11, 15, 25, 0.92);
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

    /* Nom de l'entreprise affiché sous chaque épingle :
       Masqué en zoom global, affiché automatiquement dès qu'on zoome sur la zone (zoom >= 13) */
    .custom-company-tooltip {
      background: rgba(11, 15, 25, 0.94) !important;
      border: 1px solid rgba(0, 210, 196, 0.8) !important;
      color: #FFFFFF !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      padding: 2px 7px !important;
      box-shadow: 0 3px 8px rgba(0,0,0,0.7) !important;
      max-width: 140px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      text-align: center !important;
      pointer-events: none !important;

      /* Par défaut en zoom global : invisible pour fluidifier la carte */
      opacity: 0 !important;
      visibility: hidden !important;
      transform: translateY(-2px);
      transition: opacity 0.22s ease-in-out, visibility 0.22s ease-in-out, transform 0.22s ease-in-out;
    }
    .custom-company-tooltip::before {
      border-bottom-color: rgba(11, 15, 25, 0.94) !important;
    }
    .pin-company-tip {
      color: #FFFFFF;
      font-weight: 700;
    }

    /* Dès qu'on zoome sur la zone (zoom >= 13) : affichage net et fluide */
    body.zoom-detail .custom-company-tooltip {
      opacity: 1 !important;
      visibility: visible !important;
      transform: translateY(0);
    }

    /* Sélecteur de couches */
    .leaflet-control-layers {
      background: rgba(19, 27, 46, 0.94) !important;
      border: 1px solid #00D2C4 !important;
      border-radius: 12px !important;
      color: #FFFFFF !important;
      box-shadow: 0 6px 18px rgba(0,0,0,0.7) !important;
      padding: 8px 12px !important;
      font-size: 12px !important;
      margin-top: 130px !important; /* Dégage les filtres flottants du haut */
    }
    .leaflet-control-layers-toggle {
      background-color: rgba(19, 27, 46, 0.94) !important;
      border-radius: 10px !important;
      border: 1px solid #00D2C4 !important;
      width: 36px !important;
      height: 36px !important;
      background-size: 22px 22px !important;
    }
    .leaflet-control-zoom {
      margin-bottom: 24px !important;
      margin-right: 14px !important;
    }
    .leaflet-control-zoom a {
      background: rgba(19, 27, 46, 0.92) !important;
      color: #00D2C4 !important;
      border-color: rgba(0, 210, 196, 0.35) !important;
      border-radius: 8px !important;
    }
  </style>
</head>
<body>
  <!-- Définitions vectorielles pour le relief 3D sphérique et l'aiguille métallique chromée -->
  <svg style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true">
    <defs>
      <linearGradient id="needleChrome" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#475569"/>
        <stop offset="22%" stop-color="#94A3B8"/>
        <stop offset="46%" stop-color="#FFFFFF"/>
        <stop offset="72%" stop-color="#CBD5E1"/>
        <stop offset="100%" stop-color="#334155"/>
      </linearGradient>
      <radialGradient id="sphereVolume" cx="38%" cy="26%" r="68%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.92"/>
        <stop offset="22%" stop-color="#FFFFFF" stop-opacity="0.45"/>
        <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0"/>
        <stop offset="74%" stop-color="#000000" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.75"/>
      </radialGradient>
    </defs>
  </svg>
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

    // Générateur de punaise 3D sphérique sans emoji pour les entreprises (conforme à la photo de référence)
    function createCompanyPushpinSvg(color, badgeText) {
      return '<div class="modern-pushpin">' +
        '<svg viewBox="0 0 32 48" width="32" height="48" style="display:block;overflow:visible;">' +
          // Ombre au point de contact au sol
          '<ellipse cx="16" cy="47" rx="3.5" ry="1.2" fill="rgba(0,0,0,0.65)"/>' +
          // Tige métallique effilée en acier chromé
          '<path d="M 14.8,21 L 15.3,44.5 L 16,47 L 16.7,44.5 L 17.2,21 Z" fill="url(#needleChrome)"/>' +
          // Ombre de la bille sur le haut de la tige
          '<ellipse cx="16" cy="22.5" rx="2.5" ry="0.9" fill="rgba(0,0,0,0.5)"/>' +
          // Tête sphérique en relief 3D brillant (sans emoji)
          '<g style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.55));">' +
            '<circle cx="16" cy="12" r="10.5" fill="' + color + '"/>' +
            '<circle cx="16" cy="12" r="10.5" fill="url(#sphereVolume)"/>' +
            // Reflet laqué spéculaire supérieur droit
            '<ellipse cx="19.2" cy="8.2" rx="3.4" ry="1.9" transform="rotate(22 19.2 8.2)" fill="#FFFFFF" fill-opacity="0.95"/>' +
            // Reflet secondaire doux inférieur gauche
            '<ellipse cx="11.5" cy="17" rx="2.2" ry="0.9" transform="rotate(-35 11.5 17)" fill="#FFFFFF" fill-opacity="0.22"/>' +
          '</g>' +
        '</svg>' +
        (badgeText ? '<span class="pin-badge">' + badgeText + '</span>' : '') +
      '</div>';
    }

    // Punaise 3D cyan pour l'adresse fixe / point de référence (sans emoji)
    function createHomePushpinSvg(isGps) {
      return '<div class="home-pushpin">' +
        '<svg viewBox="0 0 34 50" width="34" height="50" style="display:block;overflow:visible;">' +
          // Halo d'impulsion cyan au sol
          '<ellipse cx="17" cy="49" rx="6" ry="2" fill="none" stroke="#00D2C4" stroke-width="1.5" stroke-dasharray="3, 2"/>' +
          '<ellipse cx="17" cy="49" rx="3.5" ry="1.2" fill="rgba(0,0,0,0.65)"/>' +
          // Tige métallique effilée en acier chromé
          '<path d="M 15.8,22 L 16.3,46.5 L 17,49 L 17.7,46.5 L 18.2,22 Z" fill="url(#needleChrome)"/>' +
          '<ellipse cx="17" cy="23.5" rx="2.5" ry="0.9" fill="rgba(0,0,0,0.5)"/>' +
          // Bille sphérique cyan AlterTrack 3D
          '<g style="filter:drop-shadow(0 4px 8px rgba(0, 210, 196, 0.65));">' +
            '<circle cx="17" cy="13" r="11" fill="#00D2C4"/>' +
            '<circle cx="17" cy="13" r="11" fill="url(#sphereVolume)"/>' +
            '<ellipse cx="20.3" cy="8.8" rx="3.6" ry="2" transform="rotate(22 20.3 8.8)" fill="#FFFFFF" fill-opacity="0.95"/>' +
            '<ellipse cx="12" cy="18.5" rx="2.4" ry="1" transform="rotate(-35 12 18.5)" fill="#FFFFFF" fill-opacity="0.25"/>' +
            // Point blanc épuré central (sans emoji)
            '<circle cx="17" cy="13" r="3" fill="#FFFFFF" fill-opacity="0.9"/>' +
          '</g>' +
        '</svg>' +
      '</div>';
    }

    // Gestion de l'affichage / masquage du nom des entreprises selon le niveau de zoom
    function updateZoomLevel() {
      if (!mapInstance) return;
      var zoom = mapInstance.getZoom();
      if (zoom >= 13) {
        document.body.classList.add('zoom-detail');
      } else {
        document.body.classList.remove('zoom-detail');
      }
    }

    function renderMarkers(data, isInitial) {
      if (!mapInstance || !markersGroup) return;
      markersGroup.clearLayers();

      // 1. Punaise 3D pour l'adresse fixe / domicile (sans emoji)
      if (data.refPoint) {
        var homeSvg = createHomePushpinSvg(data.refPoint.isGps);
        var homeIcon = L.divIcon({
          className: 'custom-home-pin-icon',
          html: homeSvg,
          iconSize: [34, 50],
          iconAnchor: [17, 49],
          popupAnchor: [0, -49]
        });
        var homeMarker = L.marker([data.refPoint.latitude, data.refPoint.longitude], { icon: homeIcon, zIndexOffset: 1000 }).addTo(markersGroup);
        homeMarker.bindPopup('<div class="popup-title">' + (data.refPoint.isGps ? 'Position GPS' : 'Mon adresse fixe') + '</div><div class="popup-sub">' + escapeHtml(data.refPoint.label) + '</div>');

        if (isInitial) {
          L.circle([data.refPoint.latitude, data.refPoint.longitude], { radius: 15000, color: '#00D2C4', weight: 1.5, fillColor: '#00D2C4', fillOpacity: 0.05, dashArray: '5, 8' }).addTo(mapInstance);
          L.circle([data.refPoint.latitude, data.refPoint.longitude], { radius: 30000, color: '#0066FF', weight: 1.5, fillColor: '#0066FF', fillOpacity: 0.03, dashArray: '4, 10' }).addTo(mapInstance);
        }
      }

      // 2. Regroupement par coordonnées pour gérer les chevauchements
      var coordGroups = {};
      data.companies.forEach(function(comp) {
        var key = comp.latitude.toFixed(4) + '_' + comp.longitude.toFixed(4);
        if (!coordGroups[key]) coordGroups[key] = [];
        coordGroups[key].push(comp);
      });

      // 3. Punaises 3D d'entreprises (Punaise sphérique avec aiguille métallique chromée sans emoji)
      Object.keys(coordGroups).forEach(function(key) {
        var group = coordGroups[key];
        var total = group.length;
        var cityName = group[0].city || '';

        if (total > 1) {
          var centerLat = group[0].latitude;
          var centerLng = group[0].longitude;

          L.circleMarker([centerLat, centerLng], {
            radius: 5,
            color: '#00D2C4',
            fillColor: '#00D2C4',
            fillOpacity: 0.9,
            weight: 2
          }).addTo(markersGroup);

          if (cityName) {
            var cityLabelIcon = L.divIcon({
              className: 'city-cluster-container',
              html: '<div class="city-cluster-pill">📍 ' + escapeHtml(cityName) + ' <span class="city-count">' + total + '</span></div>',
              iconSize: [120, 24],
              iconAnchor: [60, 12]
            });
            L.marker([centerLat, centerLng], { icon: cityLabelIcon, interactive: false, zIndexOffset: 200 }).addTo(markersGroup);
          }
        }

        group.forEach(function(comp, idx) {
          var markerLat = comp.latitude;
          var markerLng = comp.longitude;

          if (total > 1) {
            var angle = (2 * Math.PI * idx) / total - (Math.PI / 2);
            var radius = total > 5 ? 0.0036 : 0.0024;
            markerLat = comp.latitude + radius * Math.cos(angle);
            markerLng = comp.longitude + (radius * 1.35) * Math.sin(angle);

            L.polyline([[comp.latitude, comp.longitude], [markerLat, markerLng]], {
              color: '#00D2C4',
              weight: 1.5,
              opacity: 0.6,
              dashArray: '3, 4'
            }).addTo(markersGroup);
          }

          // Punaise 3D sphérique réaliste sans emoji
          var badge = total > 1 ? (idx + 1) + '/' + total : '';
          var pinSvg = createCompanyPushpinSvg(comp.color, badge);

          var icon = L.divIcon({
            className: 'custom-pin-icon',
            html: pinSvg,
            iconSize: [32, 48],
            iconAnchor: [16, 47],
            popupAnchor: [0, -47]
          });

          var marker = L.marker([markerLat, markerLng], { icon: icon }).addTo(markersGroup);

          var compNameSafe = escapeHtml(comp.name);
          marker.bindTooltip('<span class="pin-company-tip">' + compNameSafe + '</span>', {
            permanent: true,
            direction: 'bottom',
            offset: [0, 2],
            className: 'custom-company-tooltip'
          });

          var popupHtml = '<div class="popup-title">' + compNameSafe + '</div>';
          if (comp.city || comp.address) popupHtml += '<div class="popup-sub">' + (comp.address ? escapeHtml(comp.address) + ' • ' : '') + escapeHtml(comp.city) + '</div>';
          if (total > 1) popupHtml += '<div class="popup-commune-info">📍 Entreprise ' + (idx + 1) + ' sur ' + total + ' à ' + escapeHtml(comp.city || 'cette commune') + '</div>';
          if (comp.distanceText) popupHtml += '<div class="popup-dist">🧭 ' + escapeHtml(comp.distanceText) + '</div>';
          popupHtml += '<a class="popup-btn" href="javascript:void(0)" onclick="selectCompany(\\'' + comp.id + '\\')">Ouvrir la fiche</a>';
          marker.bindPopup(popupHtml);

          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_PIN', companyId: comp.id }));
            }
          });
        });
      });

      if (isInitial) {
        if (markersGroup.getLayers().length > 0) {
          mapInstance.fitBounds(markersGroup.getBounds(), { padding: [60, 60], maxZoom: 13 });
        } else if (data.refPoint) {
          mapInstance.setView([data.refPoint.latitude, data.refPoint.longitude], 11);
        } else {
          mapInstance.setView([46.603354, 1.888334], 6);
        }
      }

      updateZoomLevel();
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

        // Écouter les changements de zoom pour afficher ou masquer automatiquement les noms
        mapInstance.on('zoomend', updateZoomLevel);
        mapInstance.on('zoom', updateZoomLevel);

        mapInstance.createPane('labelsPane');
        mapInstance.getPane('labelsPane').style.zIndex = '350';
        mapInstance.getPane('labelsPane').style.pointerEvents = 'none';

        var satLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: 'Esri, Maxar'
        });

        var placesLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          pane: 'labelsPane'
        });

        var roadsLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          maxNativeZoom: 18,
          opacity: 0.55,
          pane: 'labelsPane'
        });

        var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        });

        var hybridGroup = L.layerGroup([satLayer, roadsLayer, placesLayer]).addTo(mapInstance);

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

        satLayer.on('tileerror', function() {
          if (!mapInstance._osmFallback) {
            mapInstance._osmFallback = true;
            osmLayer.addTo(mapInstance);
          }
        });

        markersGroup = L.featureGroup().addTo(mapInstance);

        renderMarkers(data, true);

        setTimeout(function() {
          if (mapInstance) {
            mapInstance.invalidateSize();
            updateZoomLevel();
          }
        }, 300);
        setTimeout(function() {
          if (mapInstance) {
            mapInstance.invalidateSize();
            updateZoomLevel();
          }
        }, 800);

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      } catch (err) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      }
    }

    window.updateMapData = function(newData) {
      renderMarkers(newData, false);
      updateZoomLevel();
    };

    function selectCompany(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_COMPANY', companyId: id }));
      }
    }

    window.centerOnHome = function() {
      var data = ${mapDataJson};
      if (mapInstance && data.refPoint) {
        mapInstance.setView([data.refPoint.latitude, data.refPoint.longitude], 13, { animate: true });
        setTimeout(updateZoomLevel, 350);
      }
    };

    window.fitAll = function() {
      if (mapInstance && markersGroup && markersGroup.getLayers().length > 0) {
        mapInstance.fitBounds(markersGroup.getBounds(), { padding: [60, 60], maxZoom: 13 });
        setTimeout(updateZoomLevel, 350);
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
      {/* ========================================================= */}
      {/* MODE 1 : CARTE SATELLITE EN PLEIN ÉCRAN (PAR DÉFAUT)       */}
      {/* ========================================================= */}
      {activeTab === 'MAP' ? (
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
              <Text style={styles.loadingText}>Affichage de la carte satellite...</Text>
            </View>
          )}

          {/* ========================================================= */}
          {/* SYSTÈME DE FILTRES FLOTTANTS MODERNES (GLASSMORPHISM)      */}
          {/* ========================================================= */}
          <View style={styles.floatingTopContainer} pointerEvents="box-none">
            {/* 1. Capsule de recherche & Filtres avancés */}
            <View style={styles.floatingSearchCapsule}>
              <Ionicons name="search" size={16} color={Colors.accent} />
              <TextInput
                style={styles.floatingSearchInput}
                placeholder="Rechercher sur la carte..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={onChangeSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => onChangeSearchQuery && onChangeSearchQuery('')}
                  style={styles.clearSearchBtn}
                >
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              <View style={styles.capsuleDivider} />
              <TouchableOpacity
                style={styles.floatingFilterBtn}
                onPress={onOpenFiltersModal}
                activeOpacity={0.7}
                accessibilityLabel="Ouvrir les filtres avancés"
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={activeFiltersCount > 0 ? Colors.accent : Colors.text}
                />
                {activeFiltersCount > 0 && (
                  <View style={styles.floatingFilterBadge}>
                    <Text style={styles.floatingFilterBadgeText}>{activeFiltersCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 2. Barre horizontale de pilules de statuts & distances */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.floatingPillsScroll}
              style={styles.floatingPillsBar}
            >
              {/* Puce Switch Mode : Carte Satellite vs Radar liste */}
              <TouchableOpacity
                style={styles.floatingModePill}
                onPress={() => setActiveTab('RADAR')}
                activeOpacity={0.7}
              >
                <Ionicons name="compass-outline" size={13} color={Colors.accent} />
                <Text style={styles.floatingModePillText}>Vue Radar</Text>
              </TouchableOpacity>

              {/* Puce Tous */}
              <TouchableOpacity
                style={[
                  styles.statusPill,
                  selectedStatuses.length === 0 && styles.statusPillActiveAll,
                ]}
                onPress={onSelectAllStatuses}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    selectedStatuses.length === 0 && styles.statusPillTextActive,
                  ]}
                >
                  Tous ({totalCount || companies.length})
                </Text>
              </TouchableOpacity>

              {/* Puces de Statuts individuels */}
              {ALL_STATUS_KEYS.map((st) => {
                const isSelected = selectedStatuses.includes(st);
                const color = Colors.status[st];
                const count = stats ? stats[st] : 0;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusPill,
                      isSelected && {
                        backgroundColor: `${color}33`,
                        borderColor: color,
                      },
                    ]}
                    onPress={() => onToggleStatus && onToggleStatus(st)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                    <Text
                      style={[
                        styles.statusPillText,
                        isSelected && { color, fontWeight: '700' },
                      ]}
                    >
                      {STATUS_LABELS[st]} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.pillsDivider} />

              {/* Puces de Rayon (Distance) */}
              {(['ALL', 15, 30, 50] as const).map((r) => {
                const isSelected = maxRadius === r;
                const label = r === 'ALL' ? 'Toutes dist.' : `< ${r} km`;
                return (
                  <TouchableOpacity
                    key={String(r)}
                    style={[
                      styles.radiusPill,
                      isSelected && styles.radiusPillActive,
                    ]}
                    onPress={() => setMaxRadius(r)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.radiusPillText,
                        isSelected && styles.radiusPillTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Boutons d'actions rapides sur la carte (En bas à gauche) */}
          <View style={styles.mapFloatingControls} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.mapCtrlBtn}
              onPress={() => webViewRef.current?.injectJavaScript('window.fitAll && window.fitAll(); true;')}
              activeOpacity={0.8}
            >
              <Ionicons name="scan-outline" size={14} color="#00D2C4" />
              <Text style={styles.mapCtrlText}>Tout voir</Text>
            </TouchableOpacity>

            {refPoint ? (
              <TouchableOpacity
                style={styles.mapCtrlBtn}
                onPress={() => webViewRef.current?.injectJavaScript('window.centerOnHome && window.centerOnHome(); true;')}
                activeOpacity={0.8}
              >
                <Ionicons name="home" size={14} color="#00D2C4" />
                <Text style={styles.mapCtrlText}>Mon adresse</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.mapCtrlBtn}
                onPress={onOpenRefPointModal}
                activeOpacity={0.8}
              >
                <Ionicons name="location-outline" size={14} color={Colors.accent} />
                <Text style={styles.mapCtrlText}>Adresse fixe</Text>
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
      ) : (
        /* ========================================================= */
        /* MODE 2 : RADAR PROXIMITÉ (LISTE PAR ZONES KILOMÉTRIQUES)  */
        /* ========================================================= */
        <ScrollView style={styles.radarScroll} contentContainerStyle={styles.radarContent}>
          {/* Barre de bascule rapide vers la carte satellite */}
          <TouchableOpacity
            style={styles.radarBackToMapBar}
            onPress={() => setActiveTab('MAP')}
            activeOpacity={0.8}
          >
            <Ionicons name="earth" size={16} color="#FFFFFF" />
            <Text style={styles.radarBackToMapText}>Retourner à la Carte Satellite</Text>
            <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
          </TouchableOpacity>

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
                        <View style={{ flex: 1 }}>
                          <Text style={styles.radarCardName}>{comp.name}</Text>
                          <Text style={styles.radarCardCity}>
                            {comp.address ? `${comp.address} • ` : ''}
                            {comp.city || 'Ville non renseignée'}
                          </Text>
                        </View>
                        <StatusBadge status={comp.status} size="small" />
                      </View>

                      <View style={styles.radarCardFooter}>
                        {formattedDist ? (
                          <View style={styles.radarDistBadge}>
                            <Ionicons name="navigate-outline" size={13} color={Colors.accent} />
                            <Text style={styles.radarDistText}>{formattedDist}</Text>
                          </View>
                        ) : (
                          <View />
                        )}

                        <View style={styles.radarActionsRow}>
                          {typeof comp.latitude === 'number' && (
                            <TouchableOpacity
                              style={styles.gpsNavButton}
                              onPress={() =>
                                handleOpenGpsNavigation(
                                  comp.latitude,
                                  comp.longitude,
                                  comp.name,
                                )
                              }
                              activeOpacity={0.7}
                            >
                              <Ionicons name="navigate" size={12} color="#FFFFFF" />
                              <Text style={styles.gpsNavButtonText}>GPS</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.viewSheetButton}
                            onPress={() => onSelectCompany(comp)}
                            activeOpacity={0.7}
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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

  // Système de filtres flottants modernes (Glassmorphism)
  floatingTopContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  floatingSearchCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 19, 33, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 196, 0.35)',
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  floatingSearchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    paddingVertical: 2,
  },
  clearSearchBtn: {
    padding: 2,
  },
  capsuleDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  floatingFilterBtn: {
    position: 'relative',
    padding: 2,
  },
  floatingFilterBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  floatingFilterBadgeText: {
    color: '#0B0F19',
    fontSize: 10,
    fontWeight: '800',
  },

  // Barre horizontale de pilules de filtres
  floatingPillsBar: {
    marginTop: 8,
  },
  floatingPillsScroll: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  floatingModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 210, 196, 0.18)',
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingModePillText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(19, 27, 46, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  statusPillActiveAll: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pillsDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginHorizontal: 2,
  },
  radiusPill: {
    backgroundColor: 'rgba(19, 27, 46, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  radiusPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radiusPillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  radiusPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Boutons d'actions rapides sur la carte
  mapFloatingControls: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  mapCtrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(19, 27, 46, 0.92)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 196, 0.5)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
  },
  mapCtrlText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Fiche flottante de l'entreprise sélectionnée
  floatingCard: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}60`,
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
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

  // Styles pour le Mode 2 (Radar Proximité liste)
  radarScroll: {
    flex: 1,
  },
  radarContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 14,
  },
  radarBackToMapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  radarBackToMapText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
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
});
