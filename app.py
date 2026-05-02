from flask import Flask, render_template, jsonify, request
import pandas as pd
import re
from html import unescape
from io import BytesIO
from pathlib import Path

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


# -----------------------------
# Data loading and preprocessing
# -----------------------------
CSV_PATH = Path("jobs.csv")

if not CSV_PATH.exists():
    CSV_PATH = Path("jobs(3).csv")

df = pd.read_csv(CSV_PATH)

if "name" in df.columns and "title" not in df.columns:
    df.rename(columns={"name": "title"}, inplace=True)

for col in [
    "title",
    "company",
    "city",
    "description",
    "skills",
    "url",
    "currency",
    "salary_from",
    "salary_to",
    "published_at",
]:
    if col not in df.columns:
        df[col] = ""

df["skills"] = df["skills"].fillna("")
df["description"] = df["description"].fillna("")
df["city"] = df["city"].fillna("Не указан")
df["title"] = df["title"].fillna("Без названия")
df["company"] = df["company"].fillna("Не указана")
df["url"] = df["url"].fillna("")
df["currency"] = df["currency"].fillna("KZT")

salary_from = pd.to_numeric(df["salary_from"], errors="coerce")
salary_to = pd.to_numeric(df["salary_to"], errors="coerce")

df["salary"] = (salary_from + salary_to) / 2
df["salary"] = df["salary"].fillna(salary_from).fillna(salary_to)

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
    "Data Analyst": [
        "sql", "excel", "power bi", "tableau", "python", "pandas",
        "analytics", "аналитик", "data", "dashboard", "bi"
    ],
    "Data Scientist / ML Engineer": [
        "machine learning", "ml", "pytorch", "tensorflow", "sklearn",
        "scikit", "nlp", "computer vision", "bert", "model",
        "нейрон", "statistics"
    ],
    "Backend Developer": [
        "python", "java", "spring", "fastapi", "django", "flask",
        "node", "api", "rest", "postgresql", "mysql", "sql",
        "backend", "бэкенд"
    ],
    "Frontend Developer": [
        "html", "css", "javascript", "typescript", "react", "vue",
        "angular", "frontend", "фронтенд", "ui"
    ],
    "DevOps Engineer": [
        "docker", "kubernetes", "linux", "ci/cd", "jenkins",
        "terraform", "ansible", "nginx", "devops", "cloud"
    ],
    "QA Engineer": [
        "qa", "testing", "selenium", "test", "автотест",
        "postman", "pytest", "quality assurance"
    ],
    "Mobile Developer": [
        "android", "ios", "kotlin", "swift", "flutter",
        "react native", "mobile", "мобильн"
    ],
    "Cybersecurity Specialist": [
        "security", "cybersecurity", "owasp", "pentest", "siem",
        "безопасность", "кибербезопасность"
    ],
    "Project / Product Manager": [
        "product", "project", "agile", "scrum", "jira", "manager",
        "requirements", "roadmap", "аналитик", "бизнес"
    ]
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

        for keyword in keywords:
            if keyword in text_lower:
                score += 2 if " " in keyword else 1

        scores[profession] = score

    best_profession = max(scores, key=scores.get)
    best_score = scores[best_profession]

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

        title_lower = str(row["title"]).lower()

        for part in profession.lower().split("/"):
            for word in part.split():
                if len(word) > 2 and word in title_lower:
                    score += 2

        return score, sorted(set(matched))

    rows = []

    for _, row in df.iterrows():
        score, matched = score_row(row)

        if score > 0:
            rows.append((score, matched, row))

    if not rows:
        fallback = df.copy()
        fallback["salary_sort"] = fallback["salary_kzt"].fillna(0)

        rows = [
            (1, [], row)
            for _, row in fallback.sort_values("salary_sort", ascending=False).head(limit).iterrows()
        ]

    rows = sorted(
        rows,
        key=lambda x: (
            x[0],
            0 if pd.isna(x[2]["salary_kzt"]) else x[2]["salary_kzt"]
        ),
        reverse=True
    )[:limit]

    results = []

    for score, matched, row in rows:
        required_text = (
            str(row.get("skills", "")) + " " +
            str(row.get("description_clean", ""))
        ).lower()

        required_found = [skill for skill in ALL_SKILLS if skill in required_text]
        skills_to_improve = sorted(set(required_found) - detected)[:6]

        results.append({
            "title": row["title"],
            "company": row["company"],
            "city": row["city"],
            "salary": format_salary(row["salary_kzt"]),
            "url": row.get("url", ""),
            "description": row["description_clean"][:380] + (
                "..." if len(row["description_clean"]) > 380 else ""
            ),
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


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


# -----------------------------
# Overview filter helper
# -----------------------------
def get_overview_filtered_df():
    profession = request.args.get("profession", "").strip()

    if profession:
        return df[df["title"] == profession].copy()

    return df.copy()


@app.route("/api/professions")
def professions():
    professions_list = (
        df["title"]
        .dropna()
        .astype(str)
        .sort_values()
        .unique()
        .tolist()
    )

    return jsonify(professions_list)


# -----------------------------
# Analytics API
# -----------------------------
@app.route("/api/skills")
def skills():
    filtered = get_overview_filtered_df()

    if filtered.empty:
        return jsonify({})

    skills_series = filtered["skills"].str.split(",").explode().fillna("")
    skills_series = skills_series.str.strip().str.lower()
    skills_series = skills_series[skills_series != ""]

    return jsonify(skills_series.value_counts().head(15).to_dict())


@app.route("/api/salary")
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


@app.route("/api/cities")
def cities():
    filtered = get_overview_filtered_df()

    if filtered.empty:
        return jsonify({})

    cities_series = (
        filtered["city"]
        .dropna()
        .astype(str)
        .str.strip()
    )

    cities_series = cities_series[cities_series != ""]

    return jsonify(cities_series.value_counts().to_dict())
def normalize_region_text(text):
    text = str(text or "").strip().lower()

    replacements = {
        "ё": "е",
        "қ": "к",
        "ғ": "г",
        "ң": "н",
        "ә": "а",
        "ө": "о",
        "ү": "у",
        "ұ": "у",
        "і": "и",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = text.replace("область", "")
    text = text.replace("облысы", "")
    text = text.replace("region", "")
    text = text.replace("oblast", "")
    text = re.sub(r"\s+", " ", text).strip()

    return text


CITY_TO_REGION = {
    "алматы": "almaty",
    "almaty": "almaty",

    "астана": "akmola",
    "astana": "akmola",
    "нур-султан": "akmola",
    "nur-sultan": "akmola",
    "nur sultan": "akmola",

    "шымкент": "turkistan",
    "shymkent": "turkistan",

    "актау": "mangystau",
    "aktau": "mangystau",

    "атырау": "atyrau",
    "atyrau": "atyrau",

    "актобе": "aktobe",
    "актабе": "aktobe",
    "aktobe": "aktobe",

    "караганда": "karaganda",
    "қарағанды": "karaganda",
    "karaganda": "karaganda",

    "павлодар": "pavlodar",
    "pavlodar": "pavlodar",

    "семей": "abay",
    "semey": "abay",

    "усть-каменогорск": "east kazakhstan",
    "оскемен": "east kazakhstan",
    "өскемен": "east kazakhstan",
    "oskemen": "east kazakhstan",

    "костанай": "kostanay",
    "қостанай": "kostanay",
    "kostanay": "kostanay",

    "кызылорда": "kyzylorda",
    "қызылорда": "kyzylorda",
    "kyzylorda": "kyzylorda",

    "тараз": "zhambyl",
    "taraz": "zhambyl",

    "уральск": "west kazakhstan",
    "орал": "west kazakhstan",
    "oral": "west kazakhstan",

    "петропавловск": "north kazakhstan",
    "petropavlovsk": "north kazakhstan",

    "кокшетау": "akmola",
    "kokshetau": "akmola",

    "талдыкорган": "jetisu",
    "taldykorgan": "jetisu",

    "туркестан": "turkistan",
    "turkistan": "turkistan",

    "жезказган": "ulytau",
    "жезқазған": "ulytau",
    "zhezkazgan": "ulytau",
}


@app.route("/api/region-jobs")
def region_jobs():
    filtered = get_overview_filtered_df()

    if filtered.empty:
        return jsonify({})

    city_counts = (
        filtered["city"]
        .fillna("")
        .astype(str)
        .str.strip()
        .value_counts()
    )

    result = {}

    for city, count in city_counts.items():
        city_key = normalize_region_text(city)
        region = CITY_TO_REGION.get(city_key)

        if region:
            result[region] = result.get(region, 0) + int(count)

    return jsonify(result)

@app.route("/api/vacancy-dynamics")
def vacancy_dynamics():
    filtered = get_overview_filtered_df()

    if filtered.empty:
        return jsonify({})

    if "published_at" not in filtered.columns:
        return jsonify({})

    temp = filtered.copy()

    temp["published_at"] = pd.to_datetime(
        temp["published_at"],
        errors="coerce"
    )

    temp = temp[temp["published_at"].notna()]

    if temp.empty:
        return jsonify({})

    temp["vacancy_date"] = temp["published_at"].dt.date

    dynamics = (
        temp.groupby("vacancy_date")
        .size()
        .sort_index()
    )

    return jsonify({
        str(date): int(count)
        for date, count in dynamics.items()
    })


@app.route("/api/top-companies")
def top_companies():
    filtered = get_overview_filtered_df()

    if filtered.empty:
        return jsonify({})

    companies = filtered["company"].fillna("Не указана")
    companies = companies.replace("", "Не указана")

    return jsonify(companies.value_counts().head(7).to_dict())


@app.route("/api/stats")
def stats():
    filtered = get_overview_filtered_df()

    total = len(filtered)
    with_salary = int(filtered["salary_kzt"].notna().sum()) if total > 0 else 0
    avg_salary = filtered["salary_kzt"].mean() if total > 0 else None
    top_city = filtered["city"].value_counts().idxmax() if total > 0 else "—"
    unique_companies = int(filtered["company"].nunique()) if total > 0 else 0

    return jsonify({
        "total_jobs": total,
        "jobs_with_salary": with_salary,
        "jobs_without_salary": total - with_salary,
        "avg_salary_kzt": round(avg_salary, 0) if pd.notna(avg_salary) else None,
        "top_city": top_city,
        "unique_companies": unique_companies,
    })


@app.route("/api/filter")
def filter_jobs():
    title = request.args.get("title", "").strip()
    city = request.args.get("city", "").strip()
    min_salary = request.args.get("min_salary", "").strip()

    page = int(request.args.get("page", 1))
    per_page = 20

    filtered = df.copy()

    if title:
        filtered = filtered[filtered["title"] == title]

    if city:
        filtered = filtered[filtered["city"] == city]

    if min_salary:
        try:
            clean_salary = min_salary.replace(" ", "").replace(",", "")
            min_salary_value = float(clean_salary)

            filtered = filtered[
                filtered["salary_kzt"].notna() &
                (filtered["salary_kzt"] >= min_salary_value)
            ].copy()

            filtered["salary_distance"] = filtered["salary_kzt"] - min_salary_value

            filtered = filtered.sort_values(
                by=["salary_distance", "salary_kzt"],
                ascending=[True, True]
            )

        except ValueError:
            filtered = filtered.sort_values(
                by="salary_kzt",
                ascending=False,
                na_position="last"
            )

    else:
        filtered = filtered.sort_values(
            by="salary_kzt",
            ascending=False,
            na_position="last"
        )

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
def jobs_list():
    return jsonify(sorted(df["title"].dropna().unique().tolist()))


# -----------------------------
# AI Career Assistant API
# -----------------------------
@app.route("/api/career-assistant", methods=["POST"])
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


@app.route("/api/classify")
def classify():
    text = request.args.get("text", "")
    profession, confidence, _ = recommend_profession(text)

    return jsonify({
        "prediction": profession,
        "confidence": confidence
    })


if __name__ == "__main__":
    app.run(debug=True)