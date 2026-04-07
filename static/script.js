// Skills chart
fetch('/api/skills')
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById('skillsChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: 'Top Skills',
          data: Object.values(data)
        }]
      }
    });
  });

// Salary chart
fetch('/api/salary')
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById('salaryChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: 'Average Salary',
          data: Object.values(data)
        }]
      }
    });
  });

// Populate dropdown
fetch('/api/salary')
  .then(res => res.json())
  .then(data => {
    const select = document.getElementById('jobSelect');
    Object.keys(data).forEach(job => {
      let option = document.createElement('option');
      option.value = job;
      option.text = job;
      select.appendChild(option);
    });
  });

// Filter jobs
document.getElementById('jobSelect').addEventListener('change', function () {
    fetch(`/api/filter?title=${this.value}`)
      .then(res => res.json())
      .then(data => {
        const list = document.getElementById('results');
        list.innerHTML = "";

        data.forEach(job => {
          let li = document.createElement('li');
          li.textContent = `${job.title} | ${job.company} | ${job.salary} | ${job.city}`;
          list.appendChild(li);
        });
      });
});

// Classification
function classify() {
    const text = document.getElementById("jobText").value;

    fetch(`/api/classify?text=${text}`)
      .then(res => res.json())
      .then(data => {
        document.getElementById("prediction").innerText =
            "Prediction: " + data.prediction;
      });
}