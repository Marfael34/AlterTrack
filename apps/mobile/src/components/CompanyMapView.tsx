import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/colors';
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

export const CompanyMapView: React.FC<CompanyMapViewProps> = ({
  companies,
  refPoint,
  distancesMap,
  onSelectCompany,
  onOpenRefPointModal,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // Sécurité : masquer l'overlay de chargement après 2.5s maximum
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Filtrer les entreprises qui ont des coordonnées GPS valides
  const geolocatedCompanies = useMemo(() => {
    return companies.filter(
      (c) =>
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !isNaN(c.latitude) &&
        !isNaN(c.longitude),
    );
  }, [companies]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Données sérialisées de manière sécurisée pour Leaflet
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

  // Page HTML complète autonome embarquant Leaflet et le thème sombre CartoDB
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
    html, body, #map { width: 100%; height: 100%; background: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
    
    /* Style personnalisé des tuiles sombres */
    .leaflet-container { background: #0B0F19 !important; }
    .leaflet-bar { border: 1px solid rgba(255,255,255,0.15) !important; box-shadow: none !important; border-radius: 8px !important; overflow: hidden; }
    .leaflet-bar a { background-color: #131B2E !important; color: #FFFFFF !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
    .leaflet-bar a:hover { background-color: #1A233A !important; }
    
    /* Marqueurs personnalisés */
    .pin-home {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      background: #00D2C4;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 210, 196, 0.6);
      color: #FFFFFF;
      font-size: 18px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(0, 210, 196, 0.7); }
      70% { box-shadow: 0 0 0 16px rgba(0, 210, 196, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 210, 196, 0); }
    }
    
    .pin-company {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid #FFFFFF;
      color: #FFFFFF;
      font-weight: bold;
      font-size: 13px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
      transition: transform 0.2s;
      cursor: pointer;
    }
    .pin-company:hover, .pin-company.active {
      transform: scale(1.25);
      border-width: 3px;
      z-index: 1000 !important;
    }

    /* Style Popups */
    .leaflet-popup-content-wrapper {
      background: #131B2E !important;
      color: #FFFFFF !important;
      border: 1px solid #00D2C4;
      border-radius: 12px !important;
      padding: 4px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.6) !important;
    }
    .leaflet-popup-tip { background: #131B2E !important; }
    .popup-title { font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 2px; }
    .popup-sub { font-size: 11px; color: #A7A9BE; margin-bottom: 6px; }
    .popup-dist { font-size: 11px; font-weight: 700; color: #00D2C4; display: inline-block; margin-bottom: 6px; }
    .popup-btn {
      display: block;
      background: #0066FF;
      color: #FFFFFF;
      text-align: center;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    // Capturer les erreurs pour les remonter
    window.onerror = function(msg, url, line, col) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_ERROR',
          message: String(msg) + ' (' + line + ':' + col + ')'
        }));
      }
    };

    var mapInstance = null;
    var markersGroup = null;

    function initMap() {
      if (typeof L === 'undefined' || typeof L.map !== 'function') {
        setTimeout(initMap, 80);
        return;
      }
      if (mapInstance) return;

      try {
        var data = ${mapDataJson};

        mapInstance = L.map('map', {
          zoomControl: true,
          attributionControl: false
        });

        // Tuiles CartoDB Dark Matter adaptées à la charte AlterTrack
        var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
          attribution: '&copy; CARTO'
        }).addTo(mapInstance);

        // Fallback OpenStreetMap en cas de souci de chargement des tuiles
        darkLayer.on('tileerror', function() {
          if (!mapInstance._osmFallbackAdded) {
            mapInstance._osmFallbackAdded = true;
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19
            }).addTo(mapInstance);
          }
        });

        markersGroup = L.featureGroup().addTo(mapInstance);

        // 1. Ajouter le point de repère (Adresse fixe de référence)
        if (data.refPoint) {
          var homeIcon = L.divIcon({
            className: 'custom-icon',
            html: '<div class="pin-home">' + (data.refPoint.isGps ? '🎯' : '🏠') + '</div>',
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -20]
          });

          var homeMarker = L.marker([data.refPoint.latitude, data.refPoint.longitude], {
            icon: homeIcon,
            zIndexOffset: 1000
          }).addTo(markersGroup);

          homeMarker.bindPopup(
            '<div class="popup-title">' + (data.refPoint.isGps ? 'Position GPS actuelle' : 'Mon adresse fixe') + '</div>' +
            '<div class="popup-sub">' + data.refPoint.label + '</div>'
          );

          // Cercles de rayon (15 km et 30 km)
          L.circle([data.refPoint.latitude, data.refPoint.longitude], {
            radius: 15000,
            color: '#00D2C4',
            weight: 1.5,
            fillColor: '#00D2C4',
            fillOpacity: 0.05,
            dashArray: '5, 8'
          }).addTo(mapInstance);

          L.circle([data.refPoint.latitude, data.refPoint.longitude], {
            radius: 30000,
            color: '#0066FF',
            weight: 1.5,
            fillColor: '#0066FF',
            fillOpacity: 0.03,
            dashArray: '4, 10'
          }).addTo(mapInstance);
        }

        // 2. Ajouter les entreprises
        data.companies.forEach(function(comp) {
          var icon = L.divIcon({
            className: 'custom-icon',
            html: '<div class="pin-company" id="pin-' + comp.id + '" style="background:' + comp.color + '">🏢</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
          });

          var marker = L.marker([comp.latitude, comp.longitude], { icon: icon }).addTo(markersGroup);

          var popupHtml = '<div class="popup-title">' + comp.name + '</div>';
          if (comp.city || comp.address) {
            popupHtml += '<div class="popup-sub">' + (comp.address ? comp.address + ' • ' : '') + comp.city + '</div>';
          }
          if (comp.distanceText) {
            popupHtml += '<div class="popup-dist">🧭 ' + comp.distanceText + '</div>';
          }
          popupHtml += '<a class="popup-btn" href="javascript:void(0)" onclick="selectCompany(\\'' + comp.id + '\\')">Ouvrir la fiche</a>';

          marker.bindPopup(popupHtml);

          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_PIN', companyId: comp.id }));
            }
          });
        });

        // 3. Ajuster la vue
        if (markersGroup.getLayers().length > 0) {
          mapInstance.fitBounds(markersGroup.getBounds(), { padding: [40, 40], maxZoom: 13 });
        } else if (data.refPoint) {
          mapInstance.setView([data.refPoint.latitude, data.refPoint.longitude], 11);
        } else {
          mapInstance.setView([46.603354, 1.888334], 6); // Centre de la France
        }

        // Forcer le redimensionnement Leaflet pour éviter l'écran gris/vide
        setTimeout(function() { if (mapInstance) mapInstance.invalidateSize(); }, 200);
        setTimeout(function() { if (mapInstance) mapInstance.invalidateSize(); }, 600);
        setTimeout(function() { if (mapInstance) mapInstance.invalidateSize(); }, 1200);

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      } catch (err) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_ERROR', message: err.message }));
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

    // Charger Leaflet depuis CDN principal avec fallback CDN secondaire
    function loadScript(src, fallbackSrc, done) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = done;
      s.onerror = function() {
        if (fallbackSrc) {
          loadScript(fallbackSrc, null, done);
        }
      };
      document.head.appendChild(s);
    }

    loadScript(
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
      initMap
    );
  </script>
</body>
</html>`;
  }, [mapDataJson]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        companyId?: string;
        message?: string;
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
      } else if (data.type === 'MAP_ERROR') {
        console.warn('Leaflet map error:', data.message);
        setIsMapReady(true); // Retirer l'overlay même en cas d'erreur
      }
    } catch {
      // Ignore parse error
    }
  };

  const handleCenterOnHome = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.centerOnHome && window.centerOnHome(); true;');
    }
  };

  const handleFitAll = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.fitAll && window.fitAll(); true;');
    }
  };

  return (
    <View style={styles.container}>
      {/* Carte Leaflet dans WebView */}
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

      {/* Chargement initial */}
      {!isMapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement de la carte interactive...</Text>
        </View>
      )}

      {/* Barre supérieure : Compteur et boutons de recentrage */}
      <View style={styles.topBar}>
        <View style={styles.counterPill}>
          <Ionicons name="business" size={13} color={Colors.accent} />
          <Text style={styles.counterText}>
            {geolocatedCompanies.length} entreprise{geolocatedCompanies.length > 1 ? 's' : ''} sur la carte
          </Text>
        </View>

        <View style={styles.actionsGroup}>
          {refPoint && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCenterOnHome}
              activeOpacity={0.8}
            >
              <Ionicons name="home" size={16} color={Colors.accent} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleFitAll}
            activeOpacity={0.8}
          >
            <Ionicons name="scan" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bannière adresse fixe si non définie */}
      {!refPoint && (
        <TouchableOpacity
          style={styles.noRefBanner}
          onPress={onOpenRefPointModal}
          activeOpacity={0.8}
        >
          <Ionicons name="location" size={14} color={Colors.accent} />
          <Text style={styles.noRefText}>
            Définir votre adresse fixe pour voir les distances et cercles sur la carte
          </Text>
          <Ionicons name="chevron-forward" size={13} color={Colors.accent} />
        </TouchableOpacity>
      )}

      {/* Fiche flottante de l'entreprise sélectionnée */}
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
                <Ionicons name="compass-outline" size={12} color={Colors.primary} />
                <Text style={styles.distanceBadgeText}>
                  {LocationService.formatDistance(distancesMap[selectedCompany.id])}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.openDetailsBtn}
            onPress={() => onSelectCompany(selectedCompany)}
            activeOpacity={0.8}
          >
            <Text style={styles.openDetailsText}>Consulter la fiche détaillée</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
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
  webView: {
    flex: 1,
    backgroundColor: '#0F0E17',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F0E17',
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
  topBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.cardBackground}EE`,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  counterText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.cardBackground}EE`,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  noRefBanner: {
    position: 'absolute',
    top: 58,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.accent}20`,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    zIndex: 20,
  },
  noRefText: {
    color: Colors.accent,
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
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
    backgroundColor: `${Colors.primary}20`,
    borderWidth: 1,
    borderColor: `${Colors.primary}50`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  distanceBadgeText: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  openDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
    marginTop: 2,
  },
  openDetailsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
