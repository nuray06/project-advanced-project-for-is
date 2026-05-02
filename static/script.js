const I18N = {
  en: {
    openDashboard: 'Open Dashboard →',
    badge: 'Kazakhstan job market',
    hero1: 'Analytics of',
    hero2: 'IT vacancies',
    hero3: 'and AI Career Assistant',
    subtitle: 'Explore skills, cities, vacancies, and get a profession recommendation using your resume.',
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

    vacancies: 'Vacancies',
    jobsSub: 'Filter and view vacancies',
    allTitles: 'All positions',
    allCities: 'All cities',
    position: 'Position',
    company: 'Company',
    city: 'City',
    salaryKzt: 'Salary',
    link: 'Link',

    careerSub: 'Upload your resume (.txt/.pdf) to get a profession recommendation and matching vacancies.',
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

let skillsChartInstance = null;
let salaryChartInstance = null;
let employmentChartInstance = null;
let scheduleChartInstance = null;
let experienceChartInstance = null;
let experienceSalaryChartInstance = null;
let skillClusterChartInstance = null;

const chartStore = {};

/* =========================
   LANGUAGE
========================= */

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

/* =========================
   HELPERS
========================= */

function money(value) {
  if (!value) {
    return 'N/A';
  }

  return Math.round(Number(value) / 1000) + 'K ₸';
}

function formatFullMoney(value) {
  if (!value) {
    return 'N/A';
  }

  return Math.round(Number(value)).toLocaleString('en-US') + ' ₸';
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

function getOverviewQuery() {
  const params = new URLSearchParams();

  if (selectedOverviewProfession) {
    params.append('profession', selectedOverviewProfession);
  }

  return params.toString();
}

/* =========================
   MAP HELPERS
========================= */

const REGION_LABELS = {
  'west kazakhstan': { lat: 51.2, lon: 51.4, text: 'Oral' },
  'atyrau': { lat: 47.2, lon: 52.0, text: 'Atyrau' },
  'mangystau': { lat: 43.8, lon: 51.3, text: 'Aktau' },
  'aktobe': { lat: 50.4, lon: 57.2, text: 'Aktobe' },
  'kostanay': { lat: 53.2, lon: 63.6, text: 'Kostanay' },
  'north kazakhstan': { lat: 54.9, lon: 69.2, text: 'Petropavl' },
  'akmola': { lat: 53.0, lon: 69.4, text: 'Akmola / Astana' },
  'pavlodar': { lat: 52.3, lon: 76.95, text: 'Pavlodar' },
  'abay': { lat: 50.4, lon: 80.2, text: 'Semey' },
  'east kazakhstan': { lat: 49.95, lon: 82.63, text: 'Oskemen' },
  'ulytau': { lat: 47.8, lon: 67.7, text: 'Ulytau' },
  'karaganda': { lat: 49.8, lon: 73.1, text: 'Karaganda' },
  'kyzylorda': { lat: 44.85, lon: 65.5, text: 'Kyzylorda' },
  'turkistan': { lat: 43.3, lon: 68.3, text: 'Turkistan / Shymkent' },
  'zhambyl': { lat: 42.9, lon: 71.37, text: 'Taraz' },
  'almaty': { lat: 43.9, lon: 76.9, text: 'Almaty' },
  'jetisu': { lat: 45.0, lon: 78.4, text: 'Jetisu' }
};

function normalizeRegionText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/қ/g, 'к')
    .replace(/ғ/g, 'г')
    .replace(/ң/g, 'н')
    .replace(/ә/g, 'а')
    .replace(/ө/g, 'о')
    .replace(/ү/g, 'у')
    .replace(/ұ/g, 'у')
    .replace(/і/g, 'и')
    .replace(/область/g, '')
    .replace(/облысы/g, '')
    .replace(/region/g, '')
    .replace(/oblast/g, '')
    .replace(/city/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFeatureNameFromGeo(feature) {
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

function featureNameToRegionKey(featureName) {
  const name = normalizeRegionText(featureName);

  const aliases = {
    'west kazakhstan': 'west kazakhstan',
    'batys kazakhstan': 'west kazakhstan',
    'zapadno kazakhstanskaya': 'west kazakhstan',

    'atyrau': 'atyrau',

    'mangystau': 'mangystau',
    'mangghystau': 'mangystau',
    'mangistau': 'mangystau',

    'aktobe': 'aktobe',
    'aqtobe': 'aktobe',

    'kostanay': 'kostanay',
    'qostanay': 'kostanay',

    'north kazakhstan': 'north kazakhstan',
    'soltustik kazakhstan': 'north kazakhstan',
    'severo kazakhstanskaya': 'north kazakhstan',

    'akmola': 'akmola',
    'aqmola': 'akmola',

    'pavlodar': 'pavlodar',

    'abay': 'abay',

    'east kazakhstan': 'east kazakhstan',
    'shygys kazakhstan': 'east kazakhstan',
    'vostochno kazakhstanskaya': 'east kazakhstan',

    'ulytau': 'ulytau',

    'karaganda': 'karaganda',
    'qaragandy': 'karaganda',
    'qaraghandy': 'karaganda',

    'kyzylorda': 'kyzylorda',
    'qyzylorda': 'kyzylorda',

    'turkistan': 'turkistan',
    'turkestan': 'turkistan',
    'south kazakhstan': 'turkistan',
    'yuzhno kazakhstanskaya': 'turkistan',

    'zhambyl': 'zhambyl',
    'jambyl': 'zhambyl',

    'jetisu': 'jetisu',
    'zhetysu': 'jetisu',

    'almaty': 'almaty',
    'almaty qala': 'almaty',
    'almaty city': 'almaty',

    'shymkent': 'turkistan',
    'shymkent city': 'turkistan'
  };

  return aliases[name] || name;
}

function getMapElement() {
  const kzRegionMap = document.getElementById('kzRegionMap');

  if (kzRegionMap) {
    return kzRegionMap;
  }

  const candidates = document.querySelectorAll('#citiesChart');

  for (const el of candidates) {
    if (el.classList.contains('map-chart') || el.tagName.toLowerCase() !== 'canvas') {
      return el;
    }
  }

  return candidates[0] || null;
}

function renderKazakhstanMap(regionJobs) {
  const mapElement = getMapElement();

  if (!mapElement || !window.Plotly) {
    return;
  }

  fetch('/static/kz_1.json')
    .then((response) => response.json())
    .then((geojson) => {
      const features = geojson.features || [];

      const locations = [];
      const jobValues = [];
      const hoverText = [];

      const labelLat = [];
      const labelLon = [];
      const labelText = [];

      features.forEach((feature, index) => {
        const featureName = getFeatureNameFromGeo(feature);
        const regionKey = featureNameToRegionKey(featureName);

        feature.properties.map_id = String(index);

        const jobs = Number(regionJobs[regionKey] || 0);

        locations.push(String(index));
        jobValues.push(jobs);
        hoverText.push(`${featureName}<br>Vacancies: ${jobs}`);

        const label = REGION_LABELS[regionKey];

        if (label) {
          labelLat.push(label.lat);
          labelLon.push(label.lon);
          labelText.push(label.text);
        }
      });

      const maxJobs = Math.max(...jobValues, 1);

      const regionTrace = {
        type: 'choropleth',
        geojson: geojson,
        locations: locations,
        z: jobValues,
        featureidkey: 'properties.map_id',
        text: hoverText,
        hovertemplate: '%{text}<extra></extra>',
        colorscale: [
          [0, '#eef7f1'],
          [0.15, '#c8f2d7'],
          [0.35, '#83e6a7'],
          [0.55, '#38c976'],
          [0.75, '#119653'],
          [1, '#064e3b']
        ],
        zmin: 0,
        zmax: maxJobs,
        showscale: false,
        marker: {
          line: {
            color: '#ffffff',
            width: 2
          }
        }
      };

      const labelTrace = {
        type: 'scattergeo',
        mode: 'text',
        lat: labelLat,
        lon: labelLon,
        text: labelText,
        hoverinfo: 'skip',
        textfont: {
          family: "'Space Grotesk', 'Inter', Arial, sans-serif",
          size: 10,
          color: '#1f2937'
        }
      };

      const layout = {
        autosize: true,
        height: 520,
        margin: {
          t: 8,
          r: 8,
          b: 8,
          l: 8
        },
        paper_bgcolor: '#f3f4f6',
        plot_bgcolor: '#f3f4f6',
        hoverlabel: {
          bgcolor: '#111827',
          bordercolor: '#ffffff',
          font: {
            color: '#ffffff',
            size: 13,
            family: "'Space Grotesk', 'Inter', Arial, sans-serif"
          }
        },
        geo: {
          fitbounds: 'locations',
          visible: false,
          bgcolor: '#f3f4f6',
          showframe: false,
          showcoastlines: false,
          projection: {
            type: 'mercator'
          }
        }
      };

      Plotly.newPlot(mapElement, [regionTrace, labelTrace], layout, {
        responsive: true,
        displayModeBar: false
      }).then(() => {
        Plotly.Plots.resize(mapElement);
      });
    })
    .catch((error) => {
      console.error('Map error:', error);

      mapElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fb923c;">
          Map could not be loaded. Check static/kz_1.json
        </div>
      `;
    });
}

/* =========================
   DESTROY OVERVIEW
========================= */

function destroyOverviewCharts() {
  const mapElement = getMapElement();

  if (mapElement && window.Plotly) {
    Plotly.purge(mapElement);
    mapElement.innerHTML = '';
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

/* =========================
   LANDING
========================= */

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

/* =========================
   DASHBOARD INIT
========================= */

function initDashboard() {
  setLang('en');
  loadOverviewProfessionFilter();
  loadStats();
  loadCharts();
  loadFilters();
  loadJobs();
  loadCharacteristicsKPIs();
  loadSkillAnalyticsOptions();
  setupResumeUpload();
}

/* =========================
   PAGE SWITCHING
========================= */

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

/* =========================
   OVERVIEW FILTER
========================= */

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

      button.textContent = value ? label : I18N.en.allProfessions;

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

  if (menu) {
    menu.classList.toggle('open');
  }
}

function closeOverviewProfessionMenu() {
  const menu = document.getElementById('overviewProfessionMenu');

  if (menu) {
    menu.classList.remove('open');
  }
}

document.addEventListener('click', function (event) {
  const dropdown = document.getElementById('overviewProfessionDropdown');

  if (dropdown && !dropdown.contains(event.target)) {
    closeOverviewProfessionMenu();
  }
});

/* =========================
   STATS
========================= */

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

/* =========================
   CHARTS
========================= */

function loadCharts() {
  loadOverviewChartsOnly();

  const skillsCanvas = document.getElementById('skillsChart');
  const salaryCanvas = document.getElementById('salaryChart');

  fetch('/api/skills')
    .then((response) => response.json())
    .then((data) => {
      const allSkills = Object.keys(data);

      if (skillsCanvas) {
        if (skillsChartInstance) {
          skillsChartInstance.destroy();
        }

        if (!allSkills.length) {
          skillsChartInstance = createEmptyChart(skillsCanvas, 'No skills');
          return;
        }

        skillsChartInstance = new Chart(skillsCanvas, {
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
        if (salaryChartInstance) {
          salaryChartInstance.destroy();
        }

        const labels = Object.keys(data).map((title) => {
          return title.length > 38 ? title.slice(0, 38) + '…' : title;
        });

        if (!labels.length) {
          salaryChartInstance = createEmptyChart(salaryCanvas, 'No salary data');
          return;
        }

        salaryChartInstance = new Chart(salaryCanvas, {
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

  loadCharacteristicsCharts();
}

function loadOverviewChartsOnly() {
  destroyOverviewCharts();

  const query = getOverviewQuery();

  const regionJobsUrl = query ? '/api/region-jobs?' + query : '/api/region-jobs';
  const fallbackCitiesUrl = query ? '/api/cities?' + query : '/api/cities';
  const dynamicsUrl = query ? '/api/vacancy-dynamics?' + query : '/api/vacancy-dynamics';
  const skillsUrl = query ? '/api/skills?' + query : '/api/skills';
  const companiesUrl = query ? '/api/top-companies?' + query : '/api/top-companies';

  const mapElement = getMapElement();
  const vacancyDynamicsCanvas = document.getElementById('vacancyDynamicsChart');
  const skillsOverviewCanvas = document.getElementById('skillsOverviewChart');
  const companiesOverviewCanvas = document.getElementById('companiesOverviewChart');

  if (mapElement) {
    fetch(regionJobsUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('region-jobs not available');
        }

        return response.json();
      })
      .then((data) => {
        renderKazakhstanMap(data);
      })
      .catch(() => {
        fetch(fallbackCitiesUrl)
          .then((response) => response.json())
          .then((cityData) => {
            renderKazakhstanMap(cityData);
          })
          .catch((error) => {
            console.error('Map error:', error);
          });
      });
  }

  if (vacancyDynamicsCanvas) {
    fetch(dynamicsUrl)
      .then((response) => response.json())
      .then((data) => {
        const labels = Object.keys(data);
        const values = Object.values(data);

        if (vacancyDynamicsChartInstance) {
          vacancyDynamicsChartInstance.destroy();
        }

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

        if (skillsOverviewChartInstance) {
          skillsOverviewChartInstance.destroy();
        }

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

        if (companiesOverviewChartInstance) {
          companiesOverviewChartInstance.destroy();
        }

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

/* =========================
   CHARACTERISTICS
========================= */

function loadCharacteristicsKPIs() {
  fetch('/api/characteristics-kpis')
    .then((response) => response.json())
    .then((data) => {
      const juniorIndex = document.getElementById('charJuniorIndex');
      const remoteFlexibility = document.getElementById('charRemoteFlexibility');
      const salaryTransparency = document.getElementById('charSalaryTransparency');
      const skillsDensity = document.getElementById('charSkillsDensity');

      if (juniorIndex) {
        juniorIndex.textContent = `${data.junior_accessibility?.value || 0}%`;
      }

      if (remoteFlexibility) {
        remoteFlexibility.textContent = `${data.remote_flexibility?.value || 0}%`;
      }

      if (salaryTransparency) {
        salaryTransparency.textContent = `${data.salary_transparency?.value || 0}%`;
      }

      if (skillsDensity) {
        const value = data.skills_density?.value || 0;
        skillsDensity.textContent = `${value} skills`;
      }
    })
    .catch(() => {
      console.log('Could not load characteristics KPIs');
    });
}

function loadCharacteristicsCharts() {
  loadSimpleDoughnut('/api/employment', 'employmentChart', 'employmentChartInstance');
  loadSimpleDoughnut('/api/schedule', 'scheduleChart', 'scheduleChartInstance');
  loadSimpleBar('/api/experience', 'experienceChart', 'experienceChartInstance', false);
  loadSimpleBar('/api/experience-salary', 'experienceSalaryChart', 'experienceSalaryChartInstance', true);
}

function loadSimpleDoughnut(url, canvasId, instanceName) {
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    return;
  }

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      if (chartStore[instanceName]) {
        chartStore[instanceName].destroy();
      }

      chartStore[instanceName] = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data),
          datasets: [
            {
              data: Object.values(data),
              backgroundColor: [
                '#22c55e',
                '#3b82f6',
                '#f59e0b',
                '#8b5cf6',
                '#ec4899',
                '#94a3b8',
                '#64748b'
              ],
              borderWidth: 0
            }
          ]
        },
        options: {
          ...chartDefaults,
          cutout: '62%',
          plugins: {
            ...chartDefaults.plugins,
            legend: {
              display: true,
              position: 'right',
              labels: {
                color: '#94a3b8',
                padding: 16
              }
            }
          }
        }
      });
    })
    .catch(() => {
      console.log(`Could not load ${canvasId}`);
    });
}

function loadSimpleBar(url, canvasId, instanceName, moneyTicks = false) {
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    return;
  }

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      if (chartStore[instanceName]) {
        chartStore[instanceName].destroy();
      }

      chartStore[instanceName] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(data),
          datasets: [
            {
              data: Object.values(data),
              backgroundColor: moneyTicks ? 'rgba(251,146,60,.75)' : 'rgba(139,92,246,.75)',
              borderRadius: 8
            }
          ]
        },
        options: {
          ...chartDefaults,
          indexAxis: 'y',
          scales: darkScales(moneyTicks)
        }
      });
    })
    .catch(() => {
      console.log(`Could not load ${canvasId}`);
    });
}

/* =========================
   JOBS FILTERS
========================= */

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

/* =========================
   SKILL CLUSTERS
========================= */

function loadSkillAnalyticsOptions() {
  const select = document.getElementById('clusterSkillSelect');
  const insight = document.getElementById('clusterInsight');

  if (!select) {
    return;
  }

  fetch('/api/skill-options')
    .then((response) => {
      if (!response.ok) {
        throw new Error('skill-options not available');
      }

      return response.json();
    })
    .catch(() => {
      return fetch('/api/skills')
        .then((response) => response.json())
        .then((data) => Object.keys(data));
    })
    .then((skills) => {
      select.innerHTML = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Choose a skill';
      placeholder.selected = true;
      placeholder.disabled = true;
      select.appendChild(placeholder);

      skills.slice(0, 45).forEach((skill) => {
        const option = document.createElement('option');
        option.value = skill;
        option.textContent = skill;
        select.appendChild(option);
      });

      if (insight) {
        insight.innerHTML = '<span class="mini-note">Choose a skill and click “Analyze” to see related skills.</span>';
      }
    })
    .catch(() => {
      console.log('Could not load skill analytics options');
    });
}

function loadSkillClusters() {
  const select = document.getElementById('clusterSkillSelect');
  const canvas = document.getElementById('skillClusterChart');
  const insight = document.getElementById('clusterInsight');

  if (!select || !canvas) {
    return;
  }

  const skill = select.value;

  if (!skill) {
    if (insight) {
      insight.innerHTML = '<span class="mini-note">Please choose a skill first.</span>';
    }

    if (skillClusterChartInstance) {
      skillClusterChartInstance.destroy();
      skillClusterChartInstance = null;
    }

    return;
  }

  fetch('/api/skill-clusters?skill=' + encodeURIComponent(skill) + '&limit=5')
    .then((response) => response.json())
    .then((data) => {
      const related = data.related_skills || {};
      const labels = Object.keys(related);
      const values = Object.values(related);

      if (insight) {
        if (labels.length) {
          insight.innerHTML = `<b>${escapeHtml(skill.toUpperCase())}</b> often appears together with: ${labels
            .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
            .join('')}`;
        } else {
          insight.innerHTML = `Not enough related skills found for <b>${escapeHtml(skill)}</b>.`;
        }
      }

      if (skillClusterChartInstance) {
        skillClusterChartInstance.destroy();
      }

      if (!labels.length) {
        skillClusterChartInstance = createEmptyChart(canvas, 'No related skills');
        return;
      }

      skillClusterChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Co-occurrences',
              data: values,
              backgroundColor: 'rgba(6,182,212,.82)',
              borderRadius: 8
            }
          ]
        },
        options: {
          ...chartDefaults,
          indexAxis: 'y',
          scales: {
            x: {
              grid: {
                color: 'rgba(255,255,255,.05)'
              },
              ticks: {
                color: '#94a3b8',
                precision: 0
              }
            },
            y: {
              grid: {
                display: false
              },
              ticks: {
                color: '#e2e8f0'
              }
            }
          }
        }
      });
    })
    .catch(() => {
      console.log('Could not load skill clusters');
    });
}

/* =========================
   CAREER ASSISTANT
========================= */

function setupResumeUpload() {
  const fileInput = document.getElementById('resumeFile');
  const fileName = document.getElementById('resumeFileName');
  const clearButton = document.getElementById('clearResumeBtn');

  if (!fileInput) {
    return;
  }

  fileInput.addEventListener('change', function () {
    const file = this.files && this.files[0];

    if (fileName) {
      fileName.textContent = file ? file.name : 'No file selected';
      fileName.classList.toggle('selected', Boolean(file));
    }

    if (clearButton) {
      clearButton.classList.toggle('show', Boolean(file));
    }
  });
}

function clearResumeFile() {
  const fileInput = document.getElementById('resumeFile');
  const fileName = document.getElementById('resumeFileName');
  const clearButton = document.getElementById('clearResumeBtn');
  const careerResult = document.getElementById('careerResult');

  if (fileInput) {
    fileInput.value = '';
  }

  if (fileName) {
    fileName.textContent = 'No file selected';
    fileName.classList.remove('selected');
  }

  if (clearButton) {
    clearButton.classList.remove('show');
  }

  if (careerResult) {
    careerResult.innerHTML = '';
  }
}

function runCareerAssistant() {
  const resumeFile = document.getElementById('resumeFile');
  const careerResult = document.getElementById('careerResult');

  if (!careerResult) {
    return;
  }

  const file = resumeFile && resumeFile.files ? resumeFile.files[0] : null;

  if (!file) {
    careerResult.innerHTML = '<p class="page-subtitle">Please upload a resume file first (.txt or .pdf).</p>';
    return;
  }

  const extension = file.name.split('.').pop().toLowerCase();
  const allowedExtensions = ['txt', 'pdf'];

  if (!allowedExtensions.includes(extension)) {
    careerResult.innerHTML = '<p class="page-subtitle">Only .txt and .pdf resume files are supported.</p>';
    return;
  }

  const form = new FormData();
  form.append('resume', file);

  careerResult.innerHTML = '<p class="page-subtitle">Analyzing resume...</p>';

  fetch('/api/career-assistant', {
    method: 'POST',
    body: form
  })
    .then((response) => response.json())
    .then(renderCareerResult)
    .catch((error) => {
      console.error('Career assistant error:', error);
      careerResult.innerHTML = '<p class="page-subtitle">Error. Please try another file.</p>';
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
  const topScores = data.top_profession_scores || [];
  const salaryPotential = data.salary_potential || null;
  const salaryImpact = data.salary_impact || {};
  const salaryImpactItems = salaryImpact.items || [];

  const skillTags = detectedSkills.length
    ? detectedSkills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join('')
    : '<span class="tag orange">No exact skills detected</span>';

  const improveTags = skillsToImprove.length
    ? skillsToImprove.map((skill) => `<span class="tag orange">${escapeHtml(skill)}</span>`).join('')
    : '<span class="tag">Good starting profile</span>';

  const topScoreCards = topScores.length
    ? topScores.map((item) => {
        const score = Number(item.score || 0);

        return `
          <div class="job-meta">
            <b>${escapeHtml(item.profession)}</b>
            <span style="float:right">${score}%</span>
            <div style="height:7px;background:rgba(255,255,255,.08);border-radius:999px;margin-top:6px;overflow:hidden">
              <div style="height:100%;width:${Math.max(3, score)}%;background:rgba(129,140,248,.85);border-radius:999px"></div>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="job-meta">No alternative scores available.</p>';

  const salaryText = salaryPotential
    ? formatFullMoney(salaryPotential.predicted_salary)
    : 'Not enough salary data';

  const salaryDetails = salaryPotential
    ? `Expected range: ${formatFullMoney(salaryPotential.range_low)} – ${formatFullMoney(salaryPotential.range_high)}. Based on ${salaryPotential.based_on} comparable vacancies.`
    : 'Salary prediction could not be generated.';

  const salaryMethod = salaryPotential && salaryPotential.method
    ? salaryPotential.method
    : 'Estimated from dataset salary patterns.';

  const salaryImpactBlock = salaryImpactItems.length
    ? `
      <div class="summary-card" style="margin:20px 0">
        <h3>Salary impact of skills to improve</h3>
        <p class="job-meta">
          Current salary estimate: <b>${formatFullMoney(salaryImpact.baseline_salary)}</b>
        </p>

        <div class="results-table" style="margin-top:14px;border-radius:14px">
          <table>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Avg salary with skill</th>
                <th>Potential growth</th>
                <th>Based on</th>
              </tr>
            </thead>
            <tbody>
              ${salaryImpactItems.map((item) => `
                <tr>
                  <td><span class="tag">${escapeHtml(item.skill)}</span></td>
                  <td>${formatFullMoney(item.avg_with_skill)}</td>
                  <td><span class="salary-badge">+${formatFullMoney(item.potential_growth)}</span></td>
                  <td>${item.based_on} vacancies</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
    : `
      <div class="summary-card" style="margin:20px 0">
        <h3>Salary impact of skills to improve</h3>
        <p class="job-meta">
          Current salary estimate: <b>${formatFullMoney(salaryImpact.baseline_salary)}</b>
        </p>
      </div>
    `;

  const jobsHtml = matchingVacancies.length
    ? matchingVacancies.map((job) => {
        const matchedSkills = (job.matched_skills || [])
          .map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`)
          .join('') || '—';

        const improveSkills = (job.skills_to_improve || [])
          .map((skill) => `<span class="tag orange">${escapeHtml(skill)}</span>`)
          .join('') || '—';

        const matchScore = Number(job.match_score || 0);

        return `
          <div class="job-card">
            <h3>${escapeHtml(job.title)}</h3>

            <div class="job-meta">
              ${escapeHtml(job.company)} • ${escapeHtml(job.city)} •
              <span class="salary-badge">${escapeHtml(job.salary)}</span>
            </div>

            <div class="job-meta">
              Match score: <b>${matchScore}%</b>
              ${job.experience_level ? ` • Level: ${escapeHtml(job.experience_level)}` : ''}
            </div>

            <div style="height:8px;background:rgba(255,255,255,.08);border-radius:999px;margin:8px 0 12px;overflow:hidden">
              <div style="height:100%;width:${Math.max(3, matchScore)}%;background:rgba(110,231,183,.85);border-radius:999px"></div>
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
      }).join('')
    : '<p class="page-subtitle">No matching vacancies found.</p>';

  careerResult.innerHTML = `
    <div class="career-summary">
      <div class="summary-card">
        <h3>Recommended profession</h3>
        <p class="kpi-value small">${escapeHtml(data.recommended_profession || '—')}</p>
        <p class="job-meta">ML confidence: ${escapeHtml(data.confidence || 0)}%</p>
      </div>

      <div class="summary-card">
        <h3>Detected experience level</h3>
        <p class="kpi-value small">${escapeHtml(data.experience_level || 'Not specified')}</p>
        <p class="job-meta">Detected from resume text and experience keywords.</p>
      </div>

      <div class="summary-card">
        <h3>Predicted salary potential</h3>
        <p class="kpi-value small">${escapeHtml(salaryText)}</p>
        <p class="job-meta">${escapeHtml(salaryDetails)}</p>
        <p class="job-meta">${escapeHtml(salaryMethod)}</p>
      </div>
    </div>

    <div class="career-summary">
      <div class="summary-card">
        <h3>Detected skills</h3>
        ${skillTags}
      </div>

      <div class="summary-card">
        <h3>Skills to improve</h3>
        ${improveTags}
      </div>

      <div class="summary-card">
        <h3>Top profession scores</h3>
        ${topScoreCards}
      </div>
    </div>

    ${salaryImpactBlock}

    <h2 class="page-title">Best matching vacancies</h2>
    <div class="job-grid">${jobsHtml}</div>
  `;
}

document.addEventListener('DOMContentLoaded', function () {
  setLang('en');
});