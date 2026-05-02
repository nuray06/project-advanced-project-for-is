function money(v) {
  return v ? Math.round(v / 1000) + 'K ₸' : 'N/A';
}

function formatFullMoney(v) {
  return v ? Math.round(v).toLocaleString('en-US') + ' ₸' : 'N/A';
}

function loadLandingStats() {
  fetch('/api/stats')
    .then(r => r.json())
    .then(d => {
      const statTotal = document.getElementById('statTotal');
      const statCompanies = document.getElementById('statCompanies');
      const statAvg = document.getElementById('statAvg');

      if (statTotal) statTotal.textContent = d.total_jobs.toLocaleString('en-US');
      if (statCompanies) statCompanies.textContent = d.unique_companies.toLocaleString('en-US');
      if (statAvg) statAvg.textContent = money(d.avg_salary_kzt);
    });
}

function showPage(e, name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + name);

  if (page) page.classList.add('active');
  if (e && e.currentTarget) e.currentTarget.classList.add('active');
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
      cornerRadius: 10
    }
  }
};

let currentPage = 1;
let currentTitle = '';
let currentCity = '';
let totalPages = 1;

let citiesChartInstance = null;
let skillsOverviewChartInstance = null;
let skillsChartInstance = null;
let salaryChartInstance = null;
let salaryQualityChartInstance = null;
let employmentChartInstance = null;
let scheduleChartInstance = null;
let experienceChartInstance = null;
let experienceSalaryChartInstance = null;
let skillClusterChartInstance = null;

function initDashboard() {
  loadStats();
  loadCharts();
  loadCharacteristicsKPIs();
  loadFilters();
  loadJobs();
  loadSkillAnalyticsOptions();
  setupResumeUpload();
}

function loadStats() {
  fetch('/api/stats')
    .then(r => r.json())
    .then(d => {
      const total = document.getElementById('kpi-total');
      const companies = document.getElementById('kpi-companies');
      const avg = document.getElementById('kpi-avg');
      const city = document.getElementById('kpi-city');

      if (total) total.textContent = d.total_jobs.toLocaleString('en-US');
      if (companies) companies.textContent = d.unique_companies.toLocaleString('en-US');
      if (avg) avg.textContent = money(d.avg_salary_kzt);
      if (city) city.textContent = d.top_city || '—';
    });
}

function loadCharacteristicsKPIs() {
  fetch('/api/characteristics-kpis')
    .then(r => r.json())
    .then(d => {
      const juniorIndex = document.getElementById('charJuniorIndex');
      const remoteFlexibility = document.getElementById('charRemoteFlexibility');
      const salaryTransparency = document.getElementById('charSalaryTransparency');
      const skillsDensity = document.getElementById('charSkillsDensity');

      if (juniorIndex) {
        juniorIndex.textContent = `${d.junior_accessibility?.value || 0}%`;
      }

      if (remoteFlexibility) {
        remoteFlexibility.textContent = `${d.remote_flexibility?.value || 0}%`;
      }

      if (salaryTransparency) {
        salaryTransparency.textContent = `${d.salary_transparency?.value || 0}%`;
      }

      if (skillsDensity) {
        const value = d.skills_density?.value || 0;
        skillsDensity.textContent = `${value} skills`;
      }
    })
    .catch(() => {
      console.log('Could not load characteristics KPIs');
    });
}

function loadCharts() {
  fetch('/api/cities')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('citiesChart');
      if (!canvas) return;

      if (citiesChartInstance) citiesChartInstance.destroy();

      citiesChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data),
          datasets: [{
            data: Object.values(data),
            backgroundColor: [
              '#22c55e',
              '#3b82f6',
              '#f59e0b',
              '#ef4444',
              '#8b5cf6',
              '#06b6d4',
              '#ec4899',
              '#84cc16',
              '#f97316',
              '#14b8a6'
            ],
            borderWidth: 0
          }]
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
    });

  fetch('/api/skills')
    .then(r => r.json())
    .then(data => {
      const keys = Object.keys(data).slice(0, 10);

      const overviewCanvas = document.getElementById('skillsOverviewChart');

      if (overviewCanvas) {
        if (skillsOverviewChartInstance) skillsOverviewChartInstance.destroy();

        skillsOverviewChartInstance = new Chart(overviewCanvas, {
          type: 'bar',
          data: {
            labels: keys,
            datasets: [{
              data: keys.map(k => data[k]),
              backgroundColor: 'rgba(59,130,246,0.82)',
              borderRadius: 8
            }]
          },
          options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: darkScales()
          }
        });
      }

      const skillsCanvas = document.getElementById('skillsChart');

      if (skillsCanvas) {
        if (skillsChartInstance) skillsChartInstance.destroy();

        skillsChartInstance = new Chart(skillsCanvas, {
          type: 'bar',
          data: {
            labels: Object.keys(data),
            datasets: [{
              data: Object.values(data),
              backgroundColor: 'rgba(20,184,166,0.82)',
              borderRadius: 8
            }]
          },
          options: {
            ...chartDefaults,
            indexAxis: 'y',
            scales: darkScales()
          }
        });
      }
    });

  fetch('/api/salary')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('salaryChart');
      if (!canvas) return;

      if (salaryChartInstance) salaryChartInstance.destroy();

      salaryChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(data).map(x => x.length > 38 ? x.slice(0, 38) + '…' : x),
          datasets: [{
            data: Object.values(data),
            backgroundColor: 'rgba(245,158,11,0.85)',
            borderRadius: 8
          }]
        },
        options: {
          ...chartDefaults,
          indexAxis: 'y',
          scales: darkScales(true)
        }
      });
    });

  fetch('/api/salary-quality')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('salaryQualityChart');
      if (!canvas) return;

      if (salaryQualityChartInstance) salaryQualityChartInstance.destroy();

      const labels = Object.keys(data);
      const values = Object.values(data);

      const colors = labels.map(label => {
        const low = label.toLowerCase();
        return low.includes('without')
          ? 'rgba(239,68,68,0.82)'
          : 'rgba(34,197,94,0.82)';
      });

      salaryQualityChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderRadius: 8
          }]
        },
        options: {
          ...chartDefaults,
          scales: darkScales()
        }
      });
    });

  fetch('/api/employment')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('employmentChart');
      if (!canvas) return;

      if (employmentChartInstance) employmentChartInstance.destroy();

      employmentChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data),
          datasets: [{
            data: Object.values(data),
            backgroundColor: [
              '#22c55e',
              '#3b82f6',
              '#f59e0b',
              '#8b5cf6',
              '#ec4899',
              '#94a3b8'
            ],
            borderWidth: 0
          }]
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
                padding: 16,
                font: {
                  size: 12
                }
              }
            }
          }
        }
      });
    });

  fetch('/api/schedule')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('scheduleChart');
      if (!canvas) return;

      if (scheduleChartInstance) scheduleChartInstance.destroy();

      scheduleChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data),
          datasets: [{
            data: Object.values(data),
            backgroundColor: [
              '#06b6d4',
              '#22c55e',
              '#f59e0b',
              '#8b5cf6',
              '#ef4444',
              '#ec4899',
              '#94a3b8',
              '#64748b'
            ],
            borderWidth: 0
          }]
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
                padding: 16,
                font: {
                  size: 12
                }
              }
            }
          }
        }
      });
    });

  fetch('/api/experience')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('experienceChart');
      if (!canvas) return;

      if (experienceChartInstance) experienceChartInstance.destroy();

      experienceChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(data),
          datasets: [{
            label: 'Number of vacancies',
            data: Object.values(data),
            backgroundColor: 'rgba(139,92,246,0.82)',
            borderRadius: 10,
            maxBarThickness: 42
          }]
        },
        options: {
          ...chartDefaults,
          indexAxis: 'y',
          plugins: {
            ...chartDefaults.plugins,
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,.05)' },
              ticks: {
                color: '#94a3b8',
                precision: 0
              },
              title: {
                display: true,
                text: 'Number of vacancies',
                color: '#94a3b8',
                font: { size: 13, weight: '600' }
              }
            },
            y: {
              grid: { display: false },
              ticks: {
                color: '#e2e8f0',
                font: { size: 13, weight: '600' }
              },
              title: {
                display: true,
                text: 'Experience level',
                color: '#94a3b8',
                font: { size: 13, weight: '600' }
              }
            }
          }
        }
      });
    });

  fetch('/api/experience-salary')
    .then(r => r.json())
    .then(data => {
      const canvas = document.getElementById('experienceSalaryChart');
      if (!canvas) return;

      if (experienceSalaryChartInstance) experienceSalaryChartInstance.destroy();

      experienceSalaryChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(data),
          datasets: [{
            label: 'Average salary, KZT',
            data: Object.values(data),
            backgroundColor: 'rgba(249,115,22,0.84)',
            borderRadius: 10,
            maxBarThickness: 42
          }]
        },
        options: {
          ...chartDefaults,
          indexAxis: 'y',
          plugins: {
            ...chartDefaults.plugins,
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,.05)' },
              ticks: {
                color: '#94a3b8',
                callback: function(value) {
                  return (value / 1000).toFixed(0) + 'K';
                }
              },
              title: {
                display: true,
                text: 'Average salary, KZT',
                color: '#94a3b8',
                font: { size: 13, weight: '600' }
              }
            },
            y: {
              grid: { display: false },
              ticks: {
                color: '#e2e8f0',
                font: { size: 13, weight: '600' }
              },
              title: {
                display: true,
                text: 'Experience level',
                color: '#94a3b8',
                font: { size: 13, weight: '600' }
              }
            }
          }
        }
      });
    });
}

function darkScales(moneyTicks = false) {
  return {
    x: {
      grid: {
        color: 'rgba(255,255,255,.05)'
      },
      ticks: {
        color: '#94a3b8',
        callback: moneyTicks ? (v) => (v / 1000).toFixed(0) + 'K' : undefined
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
  };
}

function loadFilters() {
  fetch('/api/jobs/list')
    .then(r => r.json())
    .then(titles => {
      const titleSelect = document.getElementById('titleSelect');
      if (!titleSelect) return;

      titles.slice(0, 120).forEach(t => {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = t;
        titleSelect.appendChild(o);
      });
    });

  fetch('/api/cities')
    .then(r => r.json())
    .then(cities => {
      const citySelect = document.getElementById('citySelect');
      if (!citySelect) return;

      Object.keys(cities).forEach(c => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        citySelect.appendChild(o);
      });
    });

  const titleSelect = document.getElementById('titleSelect');
  const citySelect = document.getElementById('citySelect');

  if (titleSelect) {
    titleSelect.addEventListener('change', function () {
      currentTitle = this.value;
      currentPage = 1;
      loadJobs();
    });
  }

  if (citySelect) {
    citySelect.addEventListener('change', function () {
      currentCity = this.value;
      currentPage = 1;
      loadJobs();
    });
  }
}

function loadJobs() {
  const jobsBody = document.getElementById('jobsBody');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (!jobsBody) return;

  const params = new URLSearchParams({ page: currentPage });

  if (currentTitle) params.append('title', currentTitle);
  if (currentCity) params.append('city', currentCity);

  fetch('/api/filter?' + params)
    .then(r => r.json())
    .then(d => {
      totalPages = d.pages || 1;

      if (!d.jobs.length) {
        jobsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:35px">No jobs found</td></tr>';
        return;
      }

      jobsBody.innerHTML = d.jobs.map(j => `
        <tr>
          <td>${escapeHtml(j.title)}</td>
          <td>${escapeHtml(j.company)}</td>
          <td>${escapeHtml(j.city)}</td>
          <td><span class="salary-badge">${j.salary}</span></td>
          <td>${j.url ? `<a class="job-link" target="_blank" href="${j.url}">open →</a>` : '—'}</td>
        </tr>
      `).join('');

      if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages} (${d.total})`;
      if (prevBtn) prevBtn.disabled = currentPage <= 1;
      if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    });
}

function changePage(dir) {
  currentPage = Math.max(1, Math.min(totalPages, currentPage + dir));
  loadJobs();
}

function setupResumeUpload() {
  const resumeFile = document.getElementById('resumeFile');
  const resumeFileName = document.getElementById('resumeFileName');
  const clearResumeBtn = document.getElementById('clearResumeBtn');

  if (!resumeFile || !resumeFileName || !clearResumeBtn) return;

  resumeFile.addEventListener('change', () => {
    const file = resumeFile.files && resumeFile.files[0];

    if (file) {
      resumeFileName.textContent = file.name;
      resumeFileName.classList.add('selected');
      clearResumeBtn.classList.add('show');
    } else {
      resumeFileName.textContent = 'No file selected';
      resumeFileName.classList.remove('selected');
      clearResumeBtn.classList.remove('show');
    }
  });
}

function clearResumeFile() {
  const resumeFile = document.getElementById('resumeFile');
  const resumeFileName = document.getElementById('resumeFileName');
  const clearResumeBtn = document.getElementById('clearResumeBtn');
  const careerResult = document.getElementById('careerResult');

  if (resumeFile) {
    resumeFile.value = '';
  }

  if (resumeFileName) {
    resumeFileName.textContent = 'No file selected';
    resumeFileName.classList.remove('selected');
  }

  if (clearResumeBtn) {
    clearResumeBtn.classList.remove('show');
  }

  if (careerResult) {
    careerResult.innerHTML = '';
  }
}

function runCareerAssistant() {
  const resumeFile = document.getElementById('resumeFile');
  const careerResult = document.getElementById('careerResult');

  if (!careerResult) return;

  const f = resumeFile && resumeFile.files ? resumeFile.files[0] : null;

  if (!f) {
    careerResult.innerHTML = '<p class="page-subtitle">Please upload a resume file first (.txt or .pdf).</p>';
    return;
  }

  const allowedExtensions = ['txt', 'pdf'];
  const extension = f.name.split('.').pop().toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    careerResult.innerHTML = '<p class="page-subtitle">Only .txt and .pdf resume files are supported.</p>';
    return;
  }

  const form = new FormData();
  form.append('resume', f);

  careerResult.innerHTML = '<p class="page-subtitle">Analyzing resume...</p>';

  fetch('/api/career-assistant', {
    method: 'POST',
    body: form
  })
    .then(r => r.json())
    .then(renderCareerResult)
    .catch(() => {
      careerResult.innerHTML = '<p>Error. Please try another file.</p>';
    });
}

function renderCareerResult(d) {
  const careerResult = document.getElementById('careerResult');
  if (!careerResult) return;

  const detectedSkills = d.detected_skills || [];
  const improveSkills = d.skills_to_improve || [];
  const vacancies = d.matching_vacancies || [];
  const topScores = d.top_profession_scores || [];
  const salaryPotential = d.salary_potential;
  const salaryImpact = d.salary_impact || {};

  const skillTags = detectedSkills.length
    ? detectedSkills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')
    : '<span class="tag orange">No exact skills detected</span>';

  const improve = improveSkills.length
    ? improveSkills.map(s => `<span class="tag orange">${escapeHtml(s)}</span>`).join('')
    : '<span class="tag">Good starting profile</span>';

  const topScoreCards = topScores.length
    ? topScores.map(item => `
      <div class="job-meta">
        <b>${escapeHtml(item.profession)}</b>
        <span style="float:right">${item.score}%</span>
        <div style="height:7px;background:rgba(255,255,255,.08);border-radius:999px;margin-top:6px;overflow:hidden">
          <div style="height:100%;width:${Math.max(3, item.score)}%;background:rgba(129,140,248,.85);border-radius:999px"></div>
        </div>
      </div>
    `).join('')
    : '<p class="job-meta">No alternative scores available.</p>';

  const salaryText = salaryPotential
    ? `${formatFullMoney(salaryPotential.predicted_salary)}`
    : 'Not enough salary data';

  const salaryDetails = salaryPotential
    ? `Expected range: ${formatFullMoney(salaryPotential.range_low)} – ${formatFullMoney(salaryPotential.range_high)}. Based on ${salaryPotential.based_on} comparable vacancies.`
    : 'Salary prediction could not be generated.';

  const salaryMethod = salaryPotential && salaryPotential.method
    ? salaryPotential.method
    : 'Estimated from dataset salary patterns.';

  const salaryImpactItems = salaryImpact.items || [];

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
              ${salaryImpactItems.map(item => `
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

  const jobs = vacancies.length
    ? vacancies.map(j => `
      <div class="job-card">
        <h3>${escapeHtml(j.title)}</h3>

        <div class="job-meta">
          ${escapeHtml(j.company)} • ${escapeHtml(j.city)} •
          <span class="salary-badge">${j.salary}</span>
        </div>

        <div class="job-meta">
          Match score: <b>${j.match_score}%</b>
          ${j.experience_level ? ` • Level: ${escapeHtml(j.experience_level)}` : ''}
        </div>

        <div style="height:8px;background:rgba(255,255,255,.08);border-radius:999px;margin:8px 0 12px;overflow:hidden">
          <div style="height:100%;width:${Math.max(3, j.match_score)}%;background:rgba(110,231,183,.85);border-radius:999px"></div>
        </div>

        <p class="job-desc">${escapeHtml(j.description)}</p>

        <div>
          <b>Matched:</b>
          ${(j.matched_skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('') || '—'}
        </div>

        <div>
          <b>Improve:</b>
          ${(j.skills_to_improve || []).map(s => `<span class="tag orange">${escapeHtml(s)}</span>`).join('') || '—'}
        </div>

        ${j.url ? `<p><a class="job-link" target="_blank" href="${j.url}">Open vacancy →</a></p>` : ''}
      </div>
    `).join('')
    : '<p class="page-subtitle">No matching vacancies found.</p>';

  careerResult.innerHTML = `
    <div class="career-summary">
      <div class="summary-card">
        <h3>Recommended profession</h3>
        <p class="kpi-value small">${escapeHtml(d.recommended_profession || '—')}</p>
        <p class="job-meta">ML confidence: ${d.confidence || 0}%</p>
      </div>

      <div class="summary-card">
        <h3>Detected experience level</h3>
        <p class="kpi-value small">${escapeHtml(d.experience_level || 'Not specified')}</p>
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
        ${improve}
      </div>

      <div class="summary-card">
        <h3>Top profession scores</h3>
        ${topScoreCards}
      </div>
    </div>

    ${salaryImpactBlock}

    <h2 class="page-title">Best matching vacancies</h2>
    <div class="job-grid">${jobs}</div>
  `;
}

function loadSkillAnalyticsOptions() {
  fetch('/api/skill-options')
    .then(r => r.json())
    .then(skills => {
      const clusterSelect = document.getElementById('clusterSkillSelect');
      const clusterInsight = document.getElementById('clusterInsight');

      if (!clusterSelect) return;
      if (!skills.length) return;

      clusterSelect.innerHTML = '';

      const clusterPlaceholder = document.createElement('option');
      clusterPlaceholder.value = '';
      clusterPlaceholder.textContent = 'Choose a skill';
      clusterPlaceholder.selected = true;
      clusterPlaceholder.disabled = true;
      clusterSelect.appendChild(clusterPlaceholder);

      skills.forEach(skill => {
        const option = document.createElement('option');
        option.value = skill;
        option.textContent = skill;
        clusterSelect.appendChild(option);
      });

      if (clusterInsight) {
        clusterInsight.innerHTML = '<span class="mini-note">Choose a skill and click “Analyze” to see related skills.</span>';
      }

      if (skillClusterChartInstance) {
        skillClusterChartInstance.destroy();
        skillClusterChartInstance = null;
      }
    });
}

function loadSkillClusters() {
  const selectedSkill = document.getElementById('clusterSkillSelect')?.value;
  const insight = document.getElementById('clusterInsight');
  const canvas = document.getElementById('skillClusterChart');

  if (!canvas) return;

  if (!selectedSkill) {
    if (insight) {
      insight.innerHTML = '<span class="mini-note">Please choose a skill first.</span>';
    }

    if (skillClusterChartInstance) {
      skillClusterChartInstance.destroy();
      skillClusterChartInstance = null;
    }

    return;
  }

  fetch('/api/skill-clusters?skill=' + encodeURIComponent(selectedSkill) + '&limit=5')
    .then(r => r.json())
    .then(data => {
      const related = data.related_skills || {};
      const labels = Object.keys(related);
      const values = Object.values(related);

      if (insight) {
        if (labels.length) {
          insight.innerHTML = `<b>${escapeHtml(selectedSkill.toUpperCase())}</b> often appears together with: ${labels.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}`;
        } else {
          insight.innerHTML = `Not enough related skills found for <b>${escapeHtml(selectedSkill)}</b>.`;
        }
      }

      if (skillClusterChartInstance) {
        skillClusterChartInstance.destroy();
      }

      skillClusterChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Co-occurrences',
            data: values,
            backgroundColor: 'rgba(6,182,212,0.84)',
            borderRadius: 10,
            maxBarThickness: 42
          }]
        },
        options: {
          ...chartDefaults,
          indexAxis: 'y',
          plugins: {
            ...chartDefaults.plugins,
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,.05)' },
              ticks: {
                color: '#94a3b8',
                precision: 0
              },
              title: {
                display: true,
                text: 'Co-occurrences',
                color: '#94a3b8',
                font: { size: 13, weight: '600' }
              }
            },
            y: {
              grid: { display: false },
              ticks: {
                color: '#e2e8f0',
                font: { size: 13, weight: '600' }
              },
              title: {
                display: true,
                text: 'Related skills',
                color: '#94a3b8',
                font: { size: 13, weight: '600' }
              }
            }
          }
        }
      });
    });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}