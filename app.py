import os
import sqlite3
from functools import wraps

from flask import Flask, render_template, jsonify, request, redirect, url_for, session, flash
import pandas as pd
import re
from html import unescape
from io import BytesIO
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import psycopg2
    from psycopg2 import IntegrityError as PostgresIntegrityError
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    PostgresIntegrityError = None
    RealDictCursor = None

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB resume limit
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-change-this-secret-key")
AUTH_DB = os.path.join(app.root_path, "users.db")
DATABASE_URL = os.environ.get("DATABASE_URL")
USE_POSTGRES = bool(DATABASE_URL)
AUTH_INTEGRITY_ERRORS = (sqlite3.IntegrityError,)
if PostgresIntegrityError:
    AUTH_INTEGRITY_ERRORS = AUTH_INTEGRITY_ERRORS + (PostgresIntegrityError,)


def get_auth_db():
    if USE_POSTGRES:
        if psycopg2 is None:
            raise RuntimeError("DATABASE_URL is set, but psycopg2-binary is not installed.")
        return psycopg2.connect(DATABASE_URL)

    conn = sqlite3.connect(AUTH_DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db():
    with get_auth_db() as conn:
        if USE_POSTGRES:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
        else:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )


def find_user_by_id(user_id):
    with get_auth_db() as conn:
        if USE_POSTGRES:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT id, username FROM users WHERE id = %s",
                    (user_id,),
                )
                return cursor.fetchone()

        return conn.execute(
            "SELECT id, username FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()


def find_user_by_username(username):
    with get_auth_db() as conn:
        if USE_POSTGRES:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT id, username, password_hash FROM users WHERE username = %s",
                    (username,),
                )
                return cursor.fetchone()

        return conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()


def create_user(username, password):
    password_hash = generate_password_hash(password)
    with get_auth_db() as conn:
        if USE_POSTGRES:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id",
                    (username, password_hash),
                )
                return cursor.fetchone()[0]

        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        return cursor.lastrowid


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return find_user_by_id(user_id)


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get("user_id"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped_view


@app.context_processor
def inject_user():
    return {"current_user": get_current_user()}


init_auth_db()

# -----------------------------
# Data loading and preprocessing
# -----------------------------
df = pd.read_csv("jobs.csv")
df.rename(columns={"name": "title"}, inplace=True)

for col in ["title", "company", "city", "description", "skills", "url", "currency"]:
    if col not in df.columns:
        df[col] = ""

# Average salary from salary_from/salary_to
salary_from = pd.to_numeric(df.get("salary_from"), errors="coerce")
salary_to = pd.to_numeric(df.get("salary_to"), errors="coerce")
df["salary"] = (salary_from + salary_to) / 2
df["salary"] = df["salary"].fillna(salary_from).fillna(salary_to)

# Fill empty values
df["skills"] = df["skills"].fillna("")
df["description"] = df["description"].fillna("")
df["city"] = df["city"].fillna("Не указан")
df["title"] = df["title"].fillna("Без названия")
df["company"] = df["company"].fillna("Не указана")
df["url"] = df["url"].fillna("")

# Salary currency conversion to KZT
RUB_TO_KZT = 5.5
USD_TO_KZT = 450

def to_kzt(row):
    salary = row["salary"]
    currency = str(row.get("currency", "KZT")).upper()
    if pd.isna(salary):
        return None
    if currency in ["RUR", "RUB"]:
        return salary * RUB_TO_KZT
    if currency == "USD":
        return salary * USD_TO_KZT
    return salary

df["salary_kzt"] = df.apply(to_kzt, axis=1)

# Clean HTML from descriptions for better matching and display
def clean_text(value):
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

df["description_clean"] = df["description"].apply(clean_text)
df["search_text"] = (
    df["title"].astype(str) + " " +
    df["company"].astype(str) + " " +
    df["city"].astype(str) + " " +
    df["description_clean"].astype(str) + " " +
    df["skills"].astype(str)
).str.lower()

# -----------------------------
# Career assistant configuration
# -----------------------------
CAREER_PROFILES = {
    "Data Analyst": ["sql", "excel", "power bi", "tableau", "python", "pandas", "analytics", "аналитик", "data", "dashboard", "bi"],
    "Data Scientist / ML Engineer": ["machine learning", "ml", "pytorch", "tensorflow", "sklearn", "scikit", "nlp", "computer vision", "bert", "model", "нейрон", "statistics"],
    "Backend Developer": ["python", "java", "spring", "fastapi", "django", "flask", "node", "api", "rest", "postgresql", "mysql", "sql", "backend", "бэкенд"],
    "Frontend Developer": ["html", "css", "javascript", "typescript", "react", "vue", "angular", "frontend", "фронтенд", "ui"],
    "DevOps Engineer": ["docker", "kubernetes", "linux", "ci/cd", "jenkins", "terraform", "ansible", "nginx", "devops", "cloud"],
    "QA Engineer": ["qa", "testing", "selenium", "test", "автотест", "postman", "pytest", "quality assurance"],
    "Mobile Developer": ["android", "ios", "kotlin", "swift", "flutter", "react native", "mobile", "мобильн"],
    "Cybersecurity Specialist": ["security", "cybersecurity", "owasp", "pentest", "siem", "безопасность", "кибербезопасность"],
    "Project / Product Manager": ["product", "project", "agile", "scrum", "jira", "manager", "requirements", "roadmap", "аналитик", "бизнес"]
}

ALL_SKILLS = sorted(set(skill for skills in CAREER_PROFILES.values() for skill in skills))


def normalize_words(text):
    return re.findall(r"[a-zA-Zа-яА-Я0-9+#./-]+", str(text).lower())


def extract_resume_text(file_storage):
    if not file_storage or not file_storage.filename:
        return ""
    filename = file_storage.filename.lower()
    raw = file_storage.read()

    if filename.endswith(".txt"):
        return raw.decode("utf-8", errors="ignore")

    if filename.endswith(".pdf"):
        # Optional PDF support. Install PyPDF2 if needed: pip install PyPDF2
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(BytesIO(raw))
            pages = []
            for page in reader.pages:
                pages.append(page.extract_text() or "")
            return "\n".join(pages)
        except Exception:
            return "PDF uploaded, but text could not be extracted. Please upload a text-based PDF or paste your skills."

    return raw.decode("utf-8", errors="ignore")


def detect_skills(text):
    text_lower = str(text).lower()
    detected = []
    for skill in ALL_SKILLS:
        if skill in text_lower:
            detected.append(skill)
    return sorted(set(detected))


def recommend_profession(text):
    text_lower = str(text).lower()
    scores = {}
    for profession, keywords in CAREER_PROFILES.items():
        score = 0
        for kw in keywords:
            if kw in text_lower:
                score += 2 if " " in kw else 1
        scores[profession] = score

    best_profession = max(scores, key=scores.get)
    best_score = scores[best_profession]

    # Never return only "Other". If user gives very few skills, use broad safe recommendation.
    if best_score == 0:
        best_profession = "Junior IT Specialist"
        confidence = 25
    else:
        max_possible = max(len(CAREER_PROFILES[best_profession]), 1)
        confidence = min(95, max(35, round((best_score / max_possible) * 100)))

    return best_profession, confidence, scores


def format_salary(value):
    if pd.isna(value) or value is None:
        return "Не указана"
    return f"{int(value):,} ₸".replace(",", " ")


def match_jobs(text, limit=8):
    words = set(normalize_words(text))
    detected = set(detect_skills(text))
    profession, _, _ = recommend_profession(text)
    profile_skills = set(CAREER_PROFILES.get(profession, []))
    important = words | detected | profile_skills

    if not important:
        important = {"junior", "стажер", "разработчик", "аналитик", "developer"}

    def score_row(row):
        search_text = row["search_text"]
        score = 0
        matched = []
        for token in important:
            if token and token in search_text:
                score += 1
                if token in ALL_SKILLS:
                    matched.append(token)
        # Give extra score if profession title is close to vacancy title
        title_lower = str(row["title"]).lower()
        for part in profession.lower().split("/"):
            for word in part.split():
                if len(word) > 2 and word in title_lower:
                    score += 2
        return score, sorted(set(matched))

    rows = []
    for idx, row in df.iterrows():
        score, matched = score_row(row)
        if score > 0:
            rows.append((score, matched, row))

    # If no exact match, still return useful popular jobs with salary/city info
    if not rows:
        fallback = df.copy()
        fallback["salary_sort"] = fallback["salary_kzt"].fillna(0)
        rows = [(1, [], row) for _, row in fallback.sort_values("salary_sort", ascending=False).head(limit).iterrows()]

    rows = sorted(rows, key=lambda x: (x[0], 0 if pd.isna(x[2]["salary_kzt"]) else x[2]["salary_kzt"]), reverse=True)[:limit]

    results = []
    for score, matched, row in rows:
        required_text = (str(row.get("skills", "")) + " " + str(row.get("description_clean", ""))).lower()
        required_found = [s for s in ALL_SKILLS if s in required_text]
        skills_to_improve = sorted(set(required_found) - detected)[:6]
        results.append({
            "title": row["title"],
            "company": row["company"],
            "city": row["city"],
            "salary": format_salary(row["salary_kzt"]),
            "url": row.get("url", ""),
            "description": row["description_clean"][:380] + ("..." if len(row["description_clean"]) > 380 else ""),
            "matched_skills": matched[:8],
            "skills_to_improve": skills_to_improve,
            "match_score": int(score)
        })
    return results


# -----------------------------
# Pages
# -----------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user = find_user_by_username(username)

        if user and check_password_hash(user["password_hash"], password):
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            next_url = request.args.get("next") or url_for("dashboard")
            if not next_url.startswith("/") or next_url.startswith("//"):
                next_url = url_for("dashboard")
            return redirect(next_url)

        flash("Неверный логин или пароль.", "error")

    return render_template("auth.html", mode="login")

@app.route("/register", methods=["GET", "POST"])
def register():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if len(username) < 3:
            flash("Логин должен быть не короче 3 символов.", "error")
        elif len(password) < 6:
            flash("Пароль должен быть не короче 6 символов.", "error")
        elif password != confirm_password:
            flash("Пароли не совпадают.", "error")
        else:
            try:
                user_id = create_user(username, password)
                session.clear()
                session["user_id"] = user_id
                session["username"] = username
                return redirect(url_for("dashboard"))
            except AUTH_INTEGRITY_ERRORS:
                flash("Пользователь с таким логином уже существует.", "error")

    return render_template("auth.html", mode="register")

@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    return redirect(url_for("home"))

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")


# -----------------------------
# Existing analytics API
# -----------------------------
@app.route("/api/skills")
@login_required
def skills():
    skills_series = df["skills"].str.split(",").explode().fillna("")
    skills_series = skills_series.str.strip().str.lower()
    skills_series = skills_series[skills_series != ""]
    return jsonify(skills_series.value_counts().head(15).to_dict())

@app.route("/api/salary")
@login_required
def salary():
    avg_salary = (
        df.groupby("title")["salary_kzt"]
        .mean()
        .dropna()
        .sort_values(ascending=False)
        .head(15)
        .round(0)
        .astype(int)
        .to_dict()
    )
    return jsonify(avg_salary)

@app.route("/api/salary-quality")
@login_required
def salary_quality():
    with_salary = int(df["salary_kzt"].notna().sum())
    without_salary = int(df["salary_kzt"].isna().sum())
    return jsonify({"With salary": with_salary, "Without salary": without_salary})

@app.route("/api/cities")
@login_required
def cities():
    return jsonify(df["city"].value_counts().head(10).to_dict())

@app.route("/api/stats")
def stats():
    total = len(df)
    with_salary = int(df["salary_kzt"].notna().sum())
    avg_salary = df["salary_kzt"].mean()
    top_city = df["city"].value_counts().idxmax()
    unique_companies = df["company"].nunique()
    return jsonify({
        "total_jobs": total,
        "jobs_with_salary": with_salary,
        "jobs_without_salary": total - with_salary,
        "avg_salary_kzt": round(avg_salary, 0) if pd.notna(avg_salary) else None,
        "top_city": top_city,
        "unique_companies": unique_companies,
    })

@app.route("/api/filter")
@login_required
def filter_jobs():
    title = request.args.get("title", "")
    city = request.args.get("city", "")
    page = int(request.args.get("page", 1))
    per_page = 20

    filtered = df.copy()
    if title:
        filtered = filtered[filtered["title"] == title]
    if city:
        filtered = filtered[filtered["city"] == city]

    total = len(filtered)
    filtered = filtered.iloc[(page - 1) * per_page: page * per_page]

    result = filtered[["title", "company", "salary_kzt", "city", "url"]].copy()
    result = result.rename(columns={"salary_kzt": "salary"})
    result["salary"] = result["salary"].apply(format_salary)

    return jsonify({
        "jobs": result.to_dict(orient="records"),
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    })

@app.route("/api/jobs/list")
@login_required
def jobs_list():
    return jsonify(sorted(df["title"].dropna().unique().tolist()))

# -----------------------------
# New AI Career Assistant API
# -----------------------------
@app.route("/api/career-assistant", methods=["POST"])
@login_required
def career_assistant():
    typed_text = request.form.get("text", "")
    resume_text = extract_resume_text(request.files.get("resume"))
    combined_text = (typed_text + "\n" + resume_text).strip()

    if not combined_text:
        combined_text = "junior it python sql html css"

    profession, confidence, scores = recommend_profession(combined_text)
    detected = detect_skills(combined_text)
    profile = CAREER_PROFILES.get(profession, [])
    missing_profile_skills = sorted(set(profile) - set(detected))[:8]

    return jsonify({
        "recommended_profession": profession,
        "confidence": confidence,
        "detected_skills": detected[:20],
        "skills_to_improve": missing_profile_skills,
        "matching_vacancies": match_jobs(combined_text, limit=8),
        "note": "This is a rule-based AI assistant: it compares your skills/resume with real vacancy text from the dataset."
    })

# Backward compatibility with old classifier button
@app.route("/api/classify")
@login_required
def classify():
    text = request.args.get("text", "")
    profession, confidence, _ = recommend_profession(text)
    return jsonify({"prediction": profession, "confidence": confidence})

if __name__ == "__main__":
    app.run(debug=True)
