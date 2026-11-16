window.SATELLITE_OVERLAY_DATA = {
  "nuozhadu": {
    "dam_id": "nuozhadu",
    "dam_name": "Nuozhadu Reservoir",
    "leaflet_bounds": [
      [
        22.63,
        100.12
      ],
      [
        23.11,
        100.45
      ]
    ],
    "events": {
      "2022-02-08": {
        "date": "2022-02-08",
        "title": "☀️ 2022-02-08 (S1 SAR + S2 MSI)",
        "layers": {
          "s2_rgb": "satellite_overlays/s2_20220208_rgb.png",
          "s2_water": "satellite_overlays/s2_20220208_water.png",
          "s1_vv": "satellite_overlays/s1_20220208_vv.png",
          "s1_water": "satellite_overlays/s1_20220208_water.png",
          "fused_water": "satellite_overlays/fused_20220208_water.png"
        },
        "stats": {
          "s2_area_km2": 36.13,
          "s1_area_km2": 35.19,
          "fused_area_km2": 36.29,
          "diff_s2_s1_km2": 0.93,
          "agreement_pct": 97.4
        }
      },
      "2020-04-19": {
        "date": "2020-04-19",
        "title": "2020-04-19 (Cloud Obscuration & SAR Recovery)",
        "layers": {
          "s2_rgb": "satellite_overlays/s2_20200419_rgb.png",
          "s2_water": "satellite_overlays/s2_20200419_water.png",
          "s1_vv": "satellite_overlays/s1_20200419_vv.png",
          "s1_water": "satellite_overlays/s1_20200419_water.png",
          "fused_water": "satellite_overlays/fused_20200419_water.png"
        },
        "stats": {
          "s2_area_km2": 23.45,
          "s1_area_km2": 33.81,
          "fused_area_km2": 34.82,
          "sar_rescue_gain_km2": 11.37,
          "sar_rescue_pct": 48.5
        }
      }
    }
  },
  "jinghong": {
    "dam_id": "jinghong",
    "dam_name": "Jinghong Reservoir",
    "leaflet_bounds": [
      [
        22.0496,
        100.3831
      ],
      [
        22.636,
        100.802
      ]
    ],
    "events": {
      "2022-02-08": {
        "date": "2022-02-08",
        "title": "☀️ 2022-02-08 (S1 + S2 + L8)",
        "layers": {
          "s2_rgb": "satellite_overlays/jh_s2_20220208_rgb.png",
          "s2_water": "satellite_overlays/jh_s2_20220208_water.png",
          "s1_vv": "satellite_overlays/jh_s1_20220208_vv.png",
          "s1_water": "satellite_overlays/jh_s1_20220208_water.png",
          "fused_water": "satellite_overlays/jh_fused_20220208_water.png",
          "l8_rgb": "satellite_overlays/jh_l8_20220215_rgb.png",
          "l8_water": "satellite_overlays/jh_l8_20220215_water.png"
        },
        "stats": {
          "s2_area_km2": 26.40,
          "s1_area_km2": 25.36,
          "fused_area_km2": 26.40,
          "l8_area_km2": 23.81,
          "diff_s2_s1_km2": 1.04,
          "agreement_pct": 96.1
        }
      },
      "2021-06-13": {
        "date": "2021-06-13",
        "title": "2021-06-13 (Monsoon Cloud & SAR Recovery)",
        "layers": {
          "s2_rgb": "satellite_overlays/jh_s2_20210613_rgb.png",
          "s2_water": "satellite_overlays/jh_s2_20210613_water.png",
          "s1_vv": "satellite_overlays/jh_s1_20210613_vv.png",
          "s1_water": "satellite_overlays/jh_s1_20210613_water.png",
          "fused_water": "satellite_overlays/jh_fused_20210613_water.png"
        },
        "stats": {
          "s2_area_km2": 3.24,
          "s1_area_km2": 25.07,
          "fused_area_km2": 25.10,
          "sar_rescue_gain_km2": 21.83,
          "sar_rescue_pct": 673.8
        }
      }
    }
  },
  "yali_falls": {
    "dam_id": "yali_falls",
    "dam_name": "Ialy (Yali Falls)",
    "leaflet_bounds": [
      [
        14.220,
        107.790
      ],
      [
        14.390,
        108.000
      ]
    ],
    "events": {
      "2024-02-16": {
        "date": "2024-02-16",
        "title": "2024-02-16 (Dry Season S2 + S1 SAR + L9)",
        "layers": {
          "s2_rgb": "satellite_overlays/yali_s2_20240216_rgb.png",
          "s2_water": "satellite_overlays/yali_s2_20240216_water.png",
          "s1_vv": "satellite_overlays/yali_s1_20240219_vv.png",
          "s1_water": "satellite_overlays/yali_s1_20240219_water.png",
          "l9_rgb": "satellite_overlays/yali_l9_20240219_rgb.png",
          "l9_water": "satellite_overlays/yali_l9_20240219_water.png",
          "fused_water": "satellite_overlays/yali_fused_20240216_water.png"
        },
        "stats": {
          "s2_area_km2": 30.14,
          "s1_area_km2": 23.01,
          "l9_area_km2": 27.10,
          "fused_area_km2": 31.99,
          "diff_s2_s1_km2": 7.13,
          "agreement_pct": 80.2,
          "altimetry_wse_m": 503.05,
          "swot_area_km2": 32.61
        }
      },
      "2023-11-15": {
        "date": "2023-11-15",
        "title": "2023-11-15 (Flood Peak FSL 515m S1 SAR + S2)",
        "layers": {
          "s1_vv": "satellite_overlays/yali_s1_20231115_vv.png",
          "s1_water": "satellite_overlays/yali_s1_20231115_water.png",
          "s2_rgb": "satellite_overlays/yali_s2_20231128_rgb.png",
          "s2_water": "satellite_overlays/yali_s2_20231128_water.png",
          "fused_water": "satellite_overlays/yali_fused_20231128_water.png"
        },
        "stats": {
          "s1_area_km2": 55.23,
          "s2_area_km2": 58.05,
          "fused_area_km2": 60.31,
          "diff_s2_s1_km2": 2.82,
          "agreement_pct": 95.1,
          "altimetry_wse_m": 515.32,
          "swot_area_km2": 50.18
        }
      }
    }
  }
};

// Backward compatibility getters:
if (!window.SATELLITE_OVERLAY_DATA.events) {
  Object.defineProperty(window.SATELLITE_OVERLAY_DATA, 'events', {
    get: function() {
      const d = (typeof currentDam !== 'undefined' && currentDam && window.SATELLITE_OVERLAY_DATA[currentDam]) ? currentDam : 'nuozhadu';
      return window.SATELLITE_OVERLAY_DATA[d].events;
    }
  });
  Object.defineProperty(window.SATELLITE_OVERLAY_DATA, 'leaflet_bounds', {
    get: function() {
      const d = (typeof currentDam !== 'undefined' && currentDam && window.SATELLITE_OVERLAY_DATA[currentDam]) ? currentDam : 'nuozhadu';
      return window.SATELLITE_OVERLAY_DATA[d].leaflet_bounds;
    }
  });
  Object.defineProperty(window.SATELLITE_OVERLAY_DATA, 'dam_id', {
    get: function() {
      return (typeof currentDam !== 'undefined' && currentDam) ? currentDam : 'nuozhadu';
    }
  });
}
