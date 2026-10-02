window.LUX_CONFIG = {
  municipio: {
    nombre: 'Rivadavia',
    tituloAplicacion: 'Reconversión LED',
    mapaInicial: { center: [-68.468, -33.191], zoom: 13 }
  },

  fuentes: {
    luminarias_2021: './luminarias_rivadavia_2021_4326.geojson',
    luminarias_2026: './luminarias_rivadavia_2026_4326.geojson'
  },

  campos: {
    2021: {
      tecnologia: ['tec', 'TEC', 'tecnologia', 'TECNOLOGIA', 'tipo', 'TIPO'],
      potencia:   ['potencia', 'POTENCIA', 'pot', 'POT', 'watts', 'WATTS']
    },
    2026: {
      tecnologia: ['tecnologia', 'TECNOLOGIA', 'tec', 'TEC', 'tipo', 'TIPO'],
      potencia:   ['potencia', 'POTENCIA', 'pot', 'POT', 'watts', 'WATTS']
    }
  },

  simbologia: { LED: '#22d3ee', SODIO: '#e2f916', OTROS: '#e6b290' },

  consumo: { horasDiarias: 11, diasMes: 30, tarifaKwh: 85 },

  estilosMapa: {
    light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    dark:  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    satellite: {
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Tiles © Esri'
        }
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }]
    }
  }
};
