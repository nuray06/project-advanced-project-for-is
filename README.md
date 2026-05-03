JobScope KZ - Job Market Analytics Dashboard

1. Project Title

JobScope KZ - Job Market Analytics Dashboard

JobScope KZ is a web application that helps analyze IT job vacancies in Kazakhstan. The project shows useful information about vacancies, salaries, required skills, companies, cities, work formats, and experience levels. It also includes an AI Career Assistant that gives career recommendations based on an uploaded resume.

2. Topic Area

The topic area of this project is Data Analytics, AI Systems, and Career Technology.

This project focuses on analyzing real vacancy data and presenting it in a clear dashboard. It also uses resume analysis and simple recommendation logic to help users understand which IT profession may match their current skills.

3. Problem Statement

Many students and junior IT specialists don't clearly understand what skills are required in the Kazakhstan IT job market.

It's also difficult for job seekers to compare salaries, experience requirements, work schedules, and employment types across different vacancies.

There aren't many simple tools that can connect resume skills with real job market data and show what a person should improve.

This problem matters because students and beginners need practical information before choosing a career path or learning new skills.

4. Proposed Solution

JobScope KZ solves this problem by creating an interactive dashboard for IT vacancy analysis.

The system loads vacancy data from CSV files, cleans and processes it, and then shows the results through charts, filters, and an interactive map.

The dashboard includes market overview, characteristics analytics, vacancy filtering, and an AI Career Assistant. The assistant lets a user upload a resume, detects skills, recommends a profession, shows skills to improve, predicts salary potential, and finds matching vacancies.

5. Target Users

The main users of this system are university students, junior IT specialists, career switchers, job seekers, and people who want to understand the IT job market in Kazakhstan.

The project can also be useful for career advisors, teachers, and students who study data analytics or web development.

6. Technology Stack

Frontend: HTML, CSS, JavaScript

Backend: Python, Flask

Data Processing: Pandas, Regex, CSV files

Visualization: Chart.js, Plotly.js

AI and Recommendation Logic: TF-IDF, Cosine Similarity, Skill Matching

Database: PostgreSQL / Neon

Authentication: Flask Sessions

Cloud or Hosting: Render, Railway, or local deployment

Other Tools: Git, GitHub, Docker, docker-compose

7. Key Features

Market Overview

The overview page shows the total number of vacancies, number of companies, average salary, top city, vacancy dynamics, top skills, top companies, and an interactive Kazakhstan region map.

Characteristics

The characteristics page gives deeper analysis of the job market. It includes Junior Accessibility Index, Remote Flexibility, Salary Transparency Score, Skills Density, top skills, salary analysis, employment type distribution, work schedule distribution, experience level distribution, and skill clusters.

Vacancies

The vacancies page lets users browse real vacancies from the dataset. Users can filter jobs by position, city, and minimum salary. Each vacancy shows position, company, city, salary, and a link.

AI Career Assistant

The AI Career Assistant lets users upload a resume in txt or pdf format. After that, the system detects skills, recommends a profession, finds skills to improve, predicts salary potential, calculates salary impact of missing skills, and shows the best matching vacancies.

Authentication

The project also includes simple user authentication: registration, login, and logout.

8. Team Members

230103076 - Data Collection and Cleaning

230103285 - Data Analyst

230103245 - Backend Development and API

230103207 - Frontend Development and Dashboard Design

9. Expected Outcome

The expected outcome is a working web application that helps users understand the Kazakhstan IT job market.
At the end of the project, we deliver an interactive dashboard with job market analytics, vacancy filtering, resume-based career recommendation, salary prediction, skill gap analysis, and user authentication.

The final result is a full-stack web application that can be run locally and stored in a GitHub repository.

10. Git Repo Link

GitHub Repository:

https://github.com/nuray06/project-advanced-project-for-is

Installation and Run

1. Clone the repository

git clone https://github.com/nuray06/project-advanced-project-for-is.git

cd project-advanced-project-for-is

2. Create a virtual environment

python -m venv .venv

3. Activate the virtual environment

For macOS or Linux:

source .venv/bin/activate

For Windows:

.venv\Scripts\activate

4. Install dependencies

pip install -r requirements.txt

5. Configure environment variables

Create a .env file in the project folder and add:

SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://username:password@host:port/database

6. Run the application

python app.py

7. Open the website

http://127.0.0.1:5000

Project Structure

project-advanced-project-for-is/
app.py
requirements.txt
docker-compose.yml
README.md
jobs.csv
templates/
index.html
dashboard.html
auth.html
static/
style.css
auth.css
script.js
kz_1.json
images/
.env

Conclusion

JobScope KZ helps make job market data easier to understand. It gives students and job seekers a practical way to see which skills are popular, what salaries look like, what experience levels are required, and which vacancies match their resume.

The project combines web development, data analysis, visualization, and simple AI-style recommendation logic in one system.
