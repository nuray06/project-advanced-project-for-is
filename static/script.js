const I18N = {
  en: {
    openDashboard: 'Open Dashboard →',
    badge: 'Kazakhstan job market',
    hero1: 'Analytics of',
    hero2: 'IT vacancies',
    hero3: 'and AI Career Assistant',
    subtitle: 'Explore skills, cities, vacancies, and get a profession recommendation using your skills or resume.',
    start: 'Start analysis →',

    jobsInBase: 'Jobs in dataset',
    companies: 'Companies',
    avgSalary: 'Average salary',

    overview: 'Overview',
    skills: 'Skills',
    salary: 'Salaries',
    jobs: 'Vacancies',
    about: 'About',

    backHome: '← Home',
    marketOverview: 'Market overview',
    overviewSub: 'Key metrics and IT vacancy trends',
    totalJobs: 'Total jobs',
    topCity: 'Top city',

    jobsByCity: 'Jobs by region',
    vacancyDynamics: 'Vacancy dynamics',
    topSkills10: 'Top-10 skills',
    topCompanies7: 'Top 7 companies with open vacancies',

    overviewProfession: 'Profession',
    allProfessions: 'All professions',

    demandedSkills: 'In-demand skills',
    skillsSub: 'Top-15 skills by mentions',

    salaryAnalysis: 'Salary analysis',
    salarySub: 'Average salaries in KZT by position',

    vacancies: 'Vacancies',
    jobsSub: 'Filter and view vacancies',
    allTitles: 'All positions',
    allCities: 'All cities',
    position: 'Position',
    company: 'Company',
    city: 'City',
    salaryKzt: 'Salary',
    link: 'Link',

    careerSub: 'Write your skills or upload a resume (.txt/.pdf) to get a profession and matching vacancies.',
    analyze: 'Analyze →',

    aboutProject: 'About project'
  }
};

let currentLang = 'en';
localStorage.setItem('lang', 'en');

if (window.Chart) {
  Chart.defaults.font.family = "'Space Grotesk', 'Inter', Arial, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#94a3b8';
}

let currentPage = 1;
let currentTitle = '';
let currentCity = '';
let currentMinSalary = '';
let totalPages = 1;
let salaryFilterTimer = null;

let selectedOverviewProfession = '';

let vacancyDynamicsChartInstance = null;
let skillsOverviewChartInstance = null;
let companiesOverviewChartInstance = null;

const KZ_CITY_COORDS = {
  'алматы': { lat: 43.238949, lon: 76.889709, label: 'Almaty' },
  'almaty': { lat: 43.238949, lon: 76.889709, label: 'Almaty' },

  'астана': { lat: 51.169392, lon: 71.449074, label: 'Astana' },
  'нур-султан': { lat: 51.169392, lon: 71.449074, label: 'Astana' },
  'nur-sultan': { lat: 51.169392, lon: 71.449074, label: 'Astana' },
  'astana': { lat: 51.169392, lon: 71.449074, label: 'Astana' },

  'шымкент': { lat: 42.341685, lon: 69.590103, label: 'Shymkent' },
  'shymkent': { lat: 42.341685, lon: 69.590103, label: 'Shymkent' },

  'караганда': { lat: 49.806355, lon: 73.085823, label: 'Karaganda' },
  'қарағанды': { lat: 49.806355, lon: 73.085823, label: 'Karaganda' },
  'karaganda': { lat: 49.806355, lon: 73.085823, label: 'Karaganda' },

  'актобе': { lat: 50.283939, lon: 57.166979, label: 'Aktobe' },
  'ақтөбе': { lat: 50.283939, lon: 57.166979, label: 'Aktobe' },
  'aktobe': { lat: 50.283939, lon: 57.166979, label: 'Aktobe' },

  'атырау': { lat: 47.094496, lon: 51.923837, label: 'Atyrau' },
  'atyrau': { lat: 47.094496, lon: 51.923837, label: 'Atyrau' },

  'актау': { lat: 43.65107, lon: 51.1975, label: 'Aktau' },
  'ақтау': { lat: 43.65107, lon: 51.1975, label: 'Aktau' },
  'aktau': { lat: 43.65107, lon: 51.1975, label: 'Aktau' },

  'павлодар': { lat: 52.287054, lon: 76.967402, label: 'Pavlodar' },
  'pavlodar': { lat: 52.287054, lon: 76.967402, label: 'Pavlodar' },

  'усть-каменогорск': { lat: 49.948347, lon: 82.6275, label: 'Ust-Kamenogorsk' },
  'өскемен': { lat: 49.948347, lon: 82.6275, label: 'Oskemen' },
  'оскемен': { lat: 49.948347, lon: 82.6275, label: 'Oskemen' },
  'oskemen': { lat: 49.948347, lon: 82.6275, label: 'Oskemen' },

  'семей': { lat: 50.411111, lon: 80.2275, label: 'Semey' },
  'semey': { lat: 50.411111, lon: 80.2275, label: 'Semey' },

  'костанай': { lat: 53.21435, lon: 63.62463, label: 'Kostanay' },
  'қостанай': { lat: 53.21435, lon: 63.62463, label: 'Kostanay' },
  'kostanay': { lat: 53.21435, lon: 63.62463, label: 'Kostanay' },

  'кызылорда': { lat: 44.848831, lon: 65.482268, label: 'Kyzylorda' },
  'қызылорда': { lat: 44.848831, lon: 65.482268, label: 'Kyzylorda' },
  'kyzylorda': { lat: 44.848831, lon: 65.482268, label: 'Kyzylorda' },

  'тараз': { lat: 42.9, lon: 71.366667, label: 'Taraz' },
  'taraz': { lat: 42.9, lon: 71.366667, label: 'Taraz' },

  'уральск': { lat: 51.227821, lon: 51.386543, label: 'Oral' },
  'орал': { lat: 51.227821, lon: 51.386543, label: 'Oral' },
  'oral': { lat: 51.227821, lon: 51.386543, label: 'Oral' },

  'петропавловск': { lat: 54.87279, lon: 69.143, label: 'Petropavlovsk' },
  'petropavlovsk': { lat: 54.87279, lon: 69.143, label: 'Petropavlovsk' },

  'кокшетау': { lat: 53.283333, lon: 69.4, label: 'Kokshetau' },
  'kokshetau': { lat: 53.283333, lon: 69.4, label: 'Kokshetau' },

  'талдыкорган': { lat: 45.015556, lon: 78.373889, label: 'Taldykorgan' },
  'taldykorgan': { lat: 45.015556, lon: 78.373889, label: 'Taldykorgan' },

  'туркестан': { lat: 43.29733, lon: 68.25175, label: 'Turkistan' },
  'turkistan': { lat: 43.29733, lon: 68.25175, label: 'Turkistan' },

  'жезказган': { lat: 47.783333, lon: 67.7, label: 'Zhezkazgan' },
  'жезқазған': { lat: 47.783333, lon: 67.7, label: 'Zhezkazgan' },
  'zhezkazgan': { lat: 47.783333, lon: 67.7, label: 'Zhezkazgan' }
};

function setLang(lang = 'en') {
  currentLang = 'en';
  localStorage.setItem('lang', 'en');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;

    if (I18N.en && I18N.en[key]) {
      el.textContent = I18N.en[key];
    }
  });

  updateOverviewProfessionLanguage();
}

function updateOverviewProfessionLanguage() {
  const button = document.getElementById('overviewProfessionBtn');
  const menu = document.getElementById('overviewProfessionMenu');

  if (button && !selectedOverviewProfession) {
    button.textContent = I18N.en.allProfessions;
  }

  if (menu) {
    const allOption = menu.querySelector('.custom-select-option[data-value=""]');

    if (allOption) {
      allOption.textContent = I18N.en.allProfessions;
    }
  }
}

function money(value) {
  if (!value) {
    return 'N/A';
  }

  return Math.round(value / 1000) + 'K ₸';
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return '—';
  }

  return Number(value).toLocaleString('en-US');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char];
  });
}

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: '#1a1a26',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      padding: 12,
      cornerRadius: 10,
      titleFont: {
        family: "'Space Grotesk', 'Inter', Arial, sans-serif",
        weight: '700'
      },
      bodyFont: {
        family: "'Space Grotesk', 'Inter', Arial, sans-serif",
        weight: '500'
      }
    }
  }
};

function darkScales(moneyTicks = false) {
  return {
    x: {
      grid: {
        color: 'rgba(255,255,255,.05)'
      },
      ticks: {
        color: '#94a3b8',
        font: {
          family: "'Space Grotesk', 'Inter', Arial, sans-serif",
          weight: '600'
        },
        callback: moneyTicks
          ? function (value) {
              return (value / 1000).toFixed(0) + 'K';
            }
          : undefined
      }
    },
    y: {
      grid: {
        display: false
      },
      ticks: {
        color: '#e2e8f0',
        font: {
          family: "'Space Grotesk', 'Inter', Arial, sans-serif",
          weight: '600'
        }
      }
    }
  };
}

function getOverviewQuery() {
  const params = new URLSearchParams();

  if (selectedOverviewProfession) {
    params.append('profession', selectedOverviewProfession);
  }

  return params.toString();
}

function destroyOverviewCharts() {
  const regionMap = document.getElementById('citiesChart');

  if (regionMap && window.Plotly) {
    Plotly.purge(regionMap);
    regionMap.innerHTML = '';
  }

  if (vacancyDynamicsChartInstance) {
    vacancyDynamicsChartInstance.destroy();
    vacancyDynamicsChartInstance = null;
  }

  if (skillsOverviewChartInstance) {
    skillsOverviewChartInstance.destroy();
    skillsOverviewChartInstance = null;
  }

  if (companiesOverviewChartInstance) {
    companiesOverviewChartInstance.destroy();
    companiesOverviewChartInstance = null;
  }
}

function createEmptyChart(canvas, label) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [label],
      datasets: [
        {
          data: [0],
          backgroundColor: 'rgba(148,163,184,.35)',
          borderRadius: 6
        }
      ]
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      scales: darkScales()
    }
  });
}

function normalizeMapName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/облысы/g, '')
    .replace(/область/g, '')
    .replace(/oblast/g, '')
    .replace(/region/g, '')
    .replace(/city/g, '')
    .replace(/қ/g, 'к')
    .replace(/ғ/g, 'г')
    .replace(/ң/g, 'н')
    .replace(/ә/g, 'а')
    .replace(/ө/g, 'о')
    .replace(/ү/g, 'у')
    .replace(/ұ/g, 'у')
    .replace(/і/g, 'и')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFeatureName(feature) {
  const props = feature.properties || {};

  return (
    props.NAME_1 ||
    props.name ||
    props.Name ||
    props.shapeName ||
    props.shape_name ||
    props.region ||
    props.Region ||
    ''
  );
}

function mapFeatureToDatasetCity(featureName) {
  const name = normalizeMapName(featureName);

  const aliases = {
    'almaty': 'Алматы',
    'almaty qala': 'Алматы',
    'almaty city': 'Алматы',

    'astana': 'Астана',
    'nur sultan': 'Астана',
    'nursultan': 'Астана',

    'shymkent': 'Шымкент',

    'karaganda': 'Караганда',
    'qaraghandy': 'Караганда',
    'qaragandy': 'Караганда',

    'aktobe': 'Актобе',
    'aqtobe': 'Актобе',

    'atyrau': 'Атырау',

    'mangystau': 'Актау',
    'mangghystau': 'Актау',
    'mangistau': 'Актау',

    'pavlodar': 'Павлодар',

    'east kazakhstan': 'Усть-Каменогорск',
    'shygys kazakhstan': 'Усть-Каменогорск',
    'vostochno kazakhstanskaya': 'Усть-Каменогорск',

    'abay': 'Семей',

    'kostanay': 'Костанай',
    'qostanay': 'Костанай',

    'kyzylorda': 'Кызылорда',
    'qyzylorda': 'Кызылорда',

    'zhambyl': 'Тараз',
    'jambyl': 'Тараз',

    'west kazakhstan': 'Уральск',
    'batys kazakhstan': 'Уральск',
    'zapadno kazakhstanskaya': 'Уральск',

    'north kazakhstan': 'Петропавловск',
    'soltustik kazakhstan': 'Петропавловск',
    'severo kazakhstanskaya': 'Петропавловск',

    'turkistan': 'Туркестан',
    'turkestan': 'Туркестан',
    'south kazakhstan': 'Туркестан',
    'yuzhno kazakhstanskaya': 'Туркестан',

    'akmola': 'Кокшетау',
    'aqmola': 'Кокшетау',

    'jetisu': 'Талдыкорган',
    'zhetysu': 'Талдыкорган',

    'ulytau': 'Жезказган'
  };

  return aliases[name] || featureName;
}

function findCityCount(cityCounts, datasetCityName) {
  const target = normalizeMapName(datasetCityName);

  for (const [city, count] of Object.entries(cityCounts || {})) {
    const normalizedCity = normalizeMapName(city);

    if (normalizedCity === target) {
      return Number(count);
    }

    if (normalizedCity.includes(target) || target.includes(normalizedCity)) {
      return Number(count);
    }
  }

  return 0;
}

function getCityInfoFromName(cityName) {
  const normalized = normalizeMapName(cityName);

  for (const [key, value] of Object.entries(KZ_CITY_COORDS)) {
    const normalizedKey = normalizeMapName(key);

    if (normalized === normalizedKey) {
      return value;
    }

    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return value;
    }
  }

  return null;
}

function buildCityMarkers(cityCounts) {
  const result = [];

  for (const [city, count] of Object.entries(cityCounts || {})) {
    const cityInfo = getCityInfoFromName(city);

    if (cityInfo && Number(count) > 0) {
      result.push({
        city: cityInfo.label,
        originalCity: city,
        count: Number(count),
        lat: cityInfo.lat,
        lon: cityInfo.lon
      });
    }
  }

  return result;
}

function renderKazakhstanRegionMap(cityCounts) {
  const mapElement = document.getElementById('citiesChart');

  if (!mapElement || !window.Plotly) {
    return;
  }

  fetch('/static/kz_1.json')
    .then((response) => response.json())
    .then((geojson) => {
      const features = geojson.features || [];

      features.forEach((feature, index) => {
        const featureName = getFeatureName(feature);
        const datasetCity = mapFeatureToDatasetCity(featureName);

        feature.properties.map_id = String(index);
        feature.properties.display_name = featureName;
        feature.properties.dataset_city = datasetCity;
      });

      const locations = [];
      const colorValues = [];
      const hoverText = [];

      features.forEach((feature) => {
        const mapId = feature.properties.map_id;
        const displayName = feature.properties.display_name;
        const datasetCity = feature.properties.dataset_city;
        const value = findCityCount(cityCounts, datasetCity);

        locations.push(mapId);

        const colorValue = value > 0 ? Math.log10(value + 1) : 0;
        colorValues.push(colorValue);

        hoverText.push(`${displayName}<br>Vacancies: ${value}`);
      });

      const maxColorValue = Math.max(...colorValues, 1);

      const regionTrace = {
        type: 'choropleth',
        geojson: geojson,
        locations: locations,
        z: colorValues,
        featureidkey: 'properties.map_id',
        text: hoverText,
        hovertemplate: '<b>%{text}</b><extra></extra>',
        colorscale: [
          [0, '#dff7ea'],
          [0.20, '#a7efc5'],
          [0.40, '#5ddf94'],
          [0.65, '#21b76b'],
          [0.85, '#0b7a4b'],
          [1, '#064e3b']
        ],
        zmin: 0,
        zmax: maxColorValue,
        showscale: false,
        marker: {
          line: {
            color: 'rgba(226, 232, 240, 0.7)',
            width: 1.2
          }
        }
      };

      const cityMarkers = buildCityMarkers(cityCounts);
      const maxCityCount = Math.max(...cityMarkers.map((item) => item.count), 1);

      const cityTrace = {
        type: 'scattergeo',
        mode: 'markers+text',
        lat: cityMarkers.map((item) => item.lat),
        lon: cityMarkers.map((item) => item.lon),
        text: cityMarkers.map((item) => {
          return item.count >= maxCityCount * 0.35 ? item.city : '';
        }),
        textposition: 'top center',
        customdata: cityMarkers.map((item) => [item.city, item.count]),
        hovertemplate: '<b>%{customdata[0]}</b><br>Vacancies: %{customdata[1]}<extra></extra>',
        marker: {
          size: cityMarkers.map((item) => 9 + Math.sqrt(item.count / maxCityCount) * 30),
          color: cityMarkers.map((item) => item.count),
          colorscale: [
            [0, '#dff7ea'],
            [0.20, '#a7efc5'],
            [0.40, '#5ddf94'],
            [0.65, '#21b76b'],
            [0.85, '#0b7a4b'],
            [1, '#064e3b']
          ],
          cmin: 0,
          cmax: maxCityCount,
          opacity: 0.96,
          showscale: false,
          line: {
            color: '#ffffff',
            width: 1.4
          }
        },
        textfont: {
          color: '#ffffff',
          size: 11,
          family: "'Space Grotesk', 'Inter', Arial, sans-serif"
        }
      };

      const layout = {
        autosize: true,
        height: 540,
        margin: {
          t: 0,
          r: 0,
          b: 0,
          l: 0
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          color: '#e2e8f0',
          family: "'Space Grotesk', 'Inter', Arial, sans-serif"
        },
        hoverlabel: {
          bgcolor: '#111827',
          bordercolor: '#16a34a',
          font: {
            color: '#ffffff',
            size: 13,
            family: "'Space Grotesk', 'Inter', Arial, sans-serif"
          }
        },
        geo: {
          fitbounds: 'locations',
          visible: false,
          bgcolor: 'rgba(0,0,0,0)',
          domain: {
            x: [0, 1],
            y: [0, 1]
          },
          projection: {
            type: 'mercator'
          }
        }
      };

      Plotly.newPlot(mapElement, [regionTrace, cityTrace], layout, {
        responsive: true,
        displayModeBar: false
      }).then(() => {
        Plotly.Plots.resize(mapElement);
      });
    })
    .catch((error) => {
      console.error('Kazakhstan map error:', error);

      mapElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fb923c;text-align:center;padding:20px;">
          Map file not found. Put kz_1.json into static folder.
        </div>
      `;
    });
}

function loadLandingStats() {
  setLang('en');

  fetch('/api/stats')
    .then((response) => response.json())
    .then((data) => {
      const statTotal = document.getElementById('statTotal');
      const statCompanies = document.getElementById('statCompanies');
      const statAvg = document.getElementById('statAvg');

      if (statTotal) {
        statTotal.textContent = formatNumber(data.total_jobs);
      }

      if (statCompanies) {
        statCompanies.textContent = formatNumber(data.unique_companies);
      }

      if (statAvg) {
        statAvg.textContent = money(data.avg_salary_kzt);
      }
    })
    .catch((error) => {
      console.error('Landing stats error:', error);
    });
}

function initDashboard() {
  setLang('en');
  loadOverviewProfessionFilter();
  loadStats();
  loadCharts();
  loadFilters();
  loadJobs();
}

function loadOverviewProfessionFilter() {
  const button = document.getElementById('overviewProfessionBtn');
  const menu = document.getElementById('overviewProfessionMenu');

  if (!button || !menu) {
    return;
  }

  menu.innerHTML = '';

  function createProfessionOption(value, label) {
    const option = document.createElement('button');

    option.type = 'button';
    option.className = 'custom-select-option';
    option.textContent = label;
    option.dataset.value = value;

    option.addEventListener('click', function () {
      selectedOverviewProfession = value;

      if (value) {
        button.textContent = label;
      } else {
        button.textContent = I18N.en.allProfessions;
      }

      document.querySelectorAll('#overviewProfessionMenu .custom-select-option').forEach((item) => {
        item.classList.remove('active');
      });

      option.classList.add('active');

      closeOverviewProfessionMenu();

      loadStats();
      loadOverviewChartsOnly();
    });

    menu.appendChild(option);

    return option;
  }

  const allOption = createProfessionOption('', I18N.en.allProfessions);
  allOption.classList.add('active');

  fetch('/api/professions')
    .then((response) => response.json())
    .then((professions) => {
      professions.forEach((profession) => {
        createProfessionOption(profession, profession);
      });
    })
    .catch((error) => {
      console.error('Overview profession filter error:', error);
    });
}

function toggleOverviewProfessionMenu() {
  const menu = document.getElementById('overviewProfessionMenu');

  if (!menu) {
    return;
  }

  menu.classList.toggle('open');
}

function closeOverviewProfessionMenu() {
  const menu = document.getElementById('overviewProfessionMenu');

  if (!menu) {
    return;
  }

  menu.classList.remove('open');
}

document.addEventListener('click', function (event) {
  const dropdown = document.getElementById('overviewProfessionDropdown');

  if (!dropdown) {
    return;
  }

  if (!dropdown.contains(event.target)) {
    closeOverviewProfessionMenu();
  }
});

function loadStats() {
  const query = getOverviewQuery();
  const url = query ? '/api/stats?' + query : '/api/stats';

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const total = document.getElementById('kpi-total');
      const companies = document.getElementById('kpi-companies');
      const avg = document.getElementById('kpi-avg');
      const city = document.getElementById('kpi-city');

      if (total) {
        total.textContent = formatNumber(data.total_jobs);
      }

      if (companies) {
        companies.textContent = formatNumber(data.unique_companies);
      }

      if (avg) {
        avg.textContent = money(data.avg_salary_kzt);
      }

      if (city) {
        city.textContent = data.top_city || '—';
      }
    })
    .catch((error) => {
      console.error('Stats error:', error);
    });
}

function loadCharts() {
  loadOverviewChartsOnly();

  const skillsCanvas = document.getElementById('skillsChart');
  const salaryCanvas = document.getElementById('salaryChart');

  fetch('/api/skills')
    .then((response) => response.json())
    .then((data) => {
      const allSkills = Object.keys(data);

      if (skillsCanvas) {
        if (!allSkills.length) {
          createEmptyChart(skillsCanvas, 'No skills');
          return;
        }

        new Chart(skillsCanvas, {
          type: 'bar',
          data: {
            labels: allSkills,
            datasets: [
              {
                data: Object.values(data),
                backgroundColor: 'rgba(110,231,183,.75)',
                borderRadius: 6
              }
            ]
          },
          options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: darkScales()
          }
        });
      }
    })
    .catch((error) => {
      console.error('Skills chart error:', error);
    });

  if (salaryCanvas) {
    fetch('/api/salary')
      .then((response) => response.json())
      .then((data) => {
        const labels = Object.keys(data).map((title) => {
          return title.length > 38 ? title.slice(0, 38) + '…' : title;
        });

        if (!labels.length) {
          createEmptyChart(salaryCanvas, 'No salary data');
          return;
        }

        new Chart(salaryCanvas, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                data: Object.values(data),
                backgroundColor: 'rgba(251,146,60,.75)',
                borderRadius: 6
              }
            ]
          },
          options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: darkScales(true)
          }
        });
      })
      .catch((error) => {
        console.error('Salary chart error:', error);
      });
  }
}

function loadOverviewChartsOnly() {
  destroyOverviewCharts();

  const query = getOverviewQuery();

  const citiesUrl = query ? '/api/cities?' + query : '/api/cities';
  const dynamicsUrl = query ? '/api/vacancy-dynamics?' + query : '/api/vacancy-dynamics';
  const skillsUrl = query ? '/api/skills?' + query : '/api/skills';
  const companiesUrl = query ? '/api/top-companies?' + query : '/api/top-companies';

  const mapElement = document.getElementById('citiesChart');
  const vacancyDynamicsCanvas = document.getElementById('vacancyDynamicsChart');
  const skillsOverviewCanvas = document.getElementById('skillsOverviewChart');
  const companiesOverviewCanvas = document.getElementById('companiesOverviewChart');

  if (mapElement) {
    fetch(citiesUrl)
      .then((response) => response.json())
      .then((data) => {
        renderKazakhstanRegionMap(data);
      })
      .catch((error) => {
        console.error('Overview region map error:', error);
      });
  }

  if (vacancyDynamicsCanvas) {
    fetch(dynamicsUrl)
      .then((response) => response.json())
      .then((data) => {
        const labels = Object.keys(data);
        const values = Object.values(data);

        if (!labels.length) {
          vacancyDynamicsChartInstance = createEmptyChart(vacancyDynamicsCanvas, 'No date data');
          return;
        }

        vacancyDynamicsChartInstance = new Chart(vacancyDynamicsCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Vacancies',
                data: values,
                borderColor: 'rgba(110, 231, 183, 1)',
                backgroundColor: 'rgba(110, 231, 183, .12)',
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 6,
                borderWidth: 3
              }
            ]
          },
          options: {
            ...chartDefaults,
            plugins: {
              ...chartDefaults.plugins,
              legend: {
                display: false
              }
            },
            scales: {
              x: {
                grid: {
                  color: 'rgba(255,255,255,.05)'
                },
                ticks: {
                  color: '#94a3b8',
                  maxRotation: 45,
                  font: {
                    family: "'Space Grotesk', 'Inter', Arial, sans-serif",
                    weight: '600'
                  }
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(255,255,255,.05)'
                },
                ticks: {
                  color: '#94a3b8',
                  precision: 0,
                  font: {
                    family: "'Space Grotesk', 'Inter', Arial, sans-serif",
                    weight: '600'
                  }
                }
              }
            }
          }
        });
      })
      .catch((error) => {
        console.error('Vacancy dynamics chart error:', error);
      });
  }

  if (skillsOverviewCanvas) {
    fetch(skillsUrl)
      .then((response) => response.json())
      .then((data) => {
        const topSkills = Object.keys(data).slice(0, 10);

        if (!topSkills.length) {
          skillsOverviewChartInstance = createEmptyChart(skillsOverviewCanvas, 'No skills');
          return;
        }

        skillsOverviewChartInstance = new Chart(skillsOverviewCanvas, {
          type: 'bar',
          data: {
            labels: topSkills,
            datasets: [
              {
                data: topSkills.map((skill) => data[skill]),
                backgroundColor: 'rgba(129,140,248,.75)',
                borderRadius: 6
              }
            ]
          },
          options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: darkScales()
          }
        });
      })
      .catch((error) => {
        console.error('Overview skills chart error:', error);
      });
  }

  if (companiesOverviewCanvas) {
    fetch(companiesUrl)
      .then((response) => response.json())
      .then((data) => {
        const companies = Object.keys(data);
        const values = Object.values(data);

        if (!companies.length) {
          companiesOverviewChartInstance = createEmptyChart(companiesOverviewCanvas, 'No companies');
          return;
        }

        companiesOverviewChartInstance = new Chart(companiesOverviewCanvas, {
          type: 'bar',
          data: {
            labels: companies,
            datasets: [
              {
                label: 'Open vacancies',
                data: values,
                backgroundColor: 'rgba(110,231,183,.75)',
                borderRadius: 7
              }
            ]
          },
          options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: darkScales()
          }
        });
      })
      .catch((error) => {
        console.error('Overview companies chart error:', error);
      });
  }
}

function showPage(event, name) {
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
  });

  const targetPage = document.getElementById('page-' + name);

  if (targetPage) {
    targetPage.classList.add('active');
  }

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

function loadFilters() {
  const titleSelect = document.getElementById('titleSelect');
  const citySelect = document.getElementById('citySelect');
  const salaryInput = document.getElementById('salaryInput');

  if (titleSelect) {
    fetch('/api/jobs/list')
      .then((response) => response.json())
      .then((titles) => {
        titles.slice(0, 120).forEach((title) => {
          const option = document.createElement('option');
          option.value = title;
          option.textContent = title;
          titleSelect.appendChild(option);
        });
      })
      .catch((error) => {
        console.error('Titles filter error:', error);
      });

    titleSelect.addEventListener('change', function () {
      currentTitle = this.value;
      currentPage = 1;
      loadJobs();
    });
  }

  if (citySelect) {
    fetch('/api/cities')
      .then((response) => response.json())
      .then((cities) => {
        Object.keys(cities).forEach((city) => {
          const option = document.createElement('option');
          option.value = city;
          option.textContent = city;
          citySelect.appendChild(option);
        });
      })
      .catch((error) => {
        console.error('Cities filter error:', error);
      });

    citySelect.addEventListener('change', function () {
      currentCity = this.value;
      currentPage = 1;
      loadJobs();
    });
  }

  if (salaryInput) {
    salaryInput.addEventListener('input', function () {
      clearTimeout(salaryFilterTimer);

      salaryFilterTimer = setTimeout(() => {
        currentMinSalary = this.value.trim();
        currentPage = 1;
        loadJobs();
      }, 400);
    });
  }
}

function loadJobs() {
  const jobsBody = document.getElementById('jobsBody');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (!jobsBody) {
    return;
  }

  const params = new URLSearchParams({
    page: currentPage
  });

  if (currentTitle) {
    params.append('title', currentTitle);
  }

  if (currentCity) {
    params.append('city', currentCity);
  }

  if (currentMinSalary) {
    params.append('min_salary', currentMinSalary);
  }

  fetch('/api/filter?' + params.toString())
    .then((response) => response.json())
    .then((data) => {
      totalPages = data.pages || 1;

      if (!data.jobs || data.jobs.length === 0) {
        jobsBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center;color:#94a3b8;padding:35px">
              No jobs found
            </td>
          </tr>
        `;

        if (pageInfo) {
          pageInfo.textContent = `0 / 0`;
        }

        if (prevBtn) {
          prevBtn.disabled = true;
        }

        if (nextBtn) {
          nextBtn.disabled = true;
        }

        return;
      }

      jobsBody.innerHTML = data.jobs
        .map((job) => {
          return `
            <tr>
              <td>${escapeHtml(job.title)}</td>
              <td>${escapeHtml(job.company)}</td>
              <td>${escapeHtml(job.city)}</td>
              <td><span class="salary-badge">${escapeHtml(job.salary)}</span></td>
              <td>
                ${
                  job.url
                    ? `<a class="job-link" target="_blank" href="${escapeHtml(job.url)}">open →</a>`
                    : '—'
                }
              </td>
            </tr>
          `;
        })
        .join('');

      if (pageInfo) {
        pageInfo.textContent = `${currentPage} / ${totalPages} (${data.total})`;
      }

      if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
      }

      if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
      }
    })
    .catch((error) => {
      console.error('Jobs table error:', error);

      jobsBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:#fb923c;padding:35px">
            Error loading jobs
          </td>
        </tr>
      `;
    });
}

function changePage(direction) {
  currentPage = Math.max(1, Math.min(totalPages, currentPage + direction));
  loadJobs();
}

function runCareerAssistant() {
  const careerText = document.getElementById('careerText');
  const resumeFile = document.getElementById('resumeFile');
  const careerResult = document.getElementById('careerResult');

  if (!careerResult) {
    return;
  }

  const form = new FormData();

  if (careerText) {
    form.append('text', careerText.value);
  }

  if (resumeFile && resumeFile.files[0]) {
    form.append('resume', resumeFile.files[0]);
  }

  careerResult.innerHTML = '<p class="page-subtitle">Analyzing...</p>';

  fetch('/api/career-assistant', {
    method: 'POST',
    body: form
  })
    .then((response) => response.json())
    .then(renderCareerResult)
    .catch((error) => {
      console.error('Career assistant error:', error);
      careerResult.innerHTML = '<p class="page-subtitle">Error. Please try again.</p>';
    });
}

function renderCareerResult(data) {
  const careerResult = document.getElementById('careerResult');

  if (!careerResult) {
    return;
  }

  const detectedSkills = data.detected_skills || [];
  const skillsToImprove = data.skills_to_improve || [];
  const matchingVacancies = data.matching_vacancies || [];

  const skillTags =
    detectedSkills
      .map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`)
      .join('') || '<span class="tag orange">No exact skills detected, but recommendation is still generated</span>';

  const improveTags =
    skillsToImprove
      .map((skill) => `<span class="tag orange">${escapeHtml(skill)}</span>`)
      .join('') || '<span class="tag">Good starting profile</span>';

  const jobsHtml = matchingVacancies
    .map((job) => {
      const matchedSkills =
        (job.matched_skills || [])
          .map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`)
          .join('') || '—';

      const improveSkills =
        (job.skills_to_improve || [])
          .map((skill) => `<span class="tag orange">${escapeHtml(skill)}</span>`)
          .join('') || '—';

      return `
        <div class="job-card">
          <h3>${escapeHtml(job.title)}</h3>

          <div class="job-meta">
            ${escapeHtml(job.company)} • ${escapeHtml(job.city)} •
            <span class="salary-badge">${escapeHtml(job.salary)}</span>
          </div>

          <p class="job-desc">${escapeHtml(job.description)}</p>

          <div>
            <b>Matched:</b> ${matchedSkills}
          </div>

          <div>
            <b>Improve:</b> ${improveSkills}
          </div>

          ${
            job.url
              ? `<p><a class="job-link" target="_blank" href="${escapeHtml(job.url)}">Open vacancy →</a></p>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  careerResult.innerHTML = `
    <div class="career-summary">
      <div class="summary-card">
        <h3>Recommended profession</h3>
        <p class="kpi-value small">${escapeHtml(data.recommended_profession)}</p>
        <p class="job-meta">Confidence: ${escapeHtml(data.confidence)}%</p>
      </div>

      <div class="summary-card">
        <h3>Detected skills</h3>
        ${skillTags}
      </div>

      <div class="summary-card">
        <h3>Skills to improve</h3>
        ${improveTags}
      </div>
    </div>

    <h2 class="page-title">Matching vacancies</h2>

    <div class="job-grid">
      ${jobsHtml || '<p class="page-subtitle">No matching vacancies found.</p>'}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', function () {
  setLang('en');
});