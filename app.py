from flask import Flask, render_template, jsonify, request
import pandas as pd
import re
import math
import os
from html import unescape
from io import BytesIO
from collections import Counter


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


# -----------------------------
# Data loading and preprocessing
# -----------------------------
DATA_FILE = "jobs(2).csv" if os.path.exists("jobs(2).csv") else "jobs.csv"
df = pd.read_csv(DATA_FILE)

# Rename name column to title
if "name" in df.columns and "title" not in df.columns:
    df.rename(columns={"name": "title"}, inplace=True)
elif "title" not in df.columns:
    df["title"] = ""

for col in [
    "title",
    "company",
    "city",
    "description",
    "skills",
    "url",
    "currency",
    "employment",
    "schedule"
]:
    if col not in df.columns:
        df[col] = ""

salary_from = pd.to_numeric(
    df["salary_from"] if "salary_from" in df.columns else pd.Series([None] * len(df)),
    errors="coerce"
)

salary_to = pd.to_numeric(
    df["salary_to"] if "salary_to" in df.columns else pd.Series([None] * len(df)),
    errors="coerce"
)

df["salary"] = (salary_from + salary_to) / 2
df["salary"] = df["salary"].fillna(salary_from).fillna(salary_to)

df["skills"] = df["skills"].fillna("")
df["description"] = df["description"].fillna("")
df["city"] = df["city"].fillna("Not specified")
df["title"] = df["title"].fillna("No title")
df["company"] = df["company"].fillna("Not specified")
df["url"] = df["url"].fillna("")

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
# Employment and schedule normalization
# -----------------------------
def normalize_employment(value):
    text = str(value or "").lower().strip()

    if not text or text == "nan":
        return "Not specified"

    if "полная" in text or "full" in text:
        return "Full-time"

    if "частичная" in text or "part" in text:
        return "Part-time"

    if "проект" in text or "project" in text:
        return "Project work"

    if "стаж" in text or "intern" in text:
        return "Internship"

    return "Other"


def normalize_schedule(value):
    text = str(value or "").lower().strip()

    if not text or text == "nan":
        return "Not specified"

    if "удален" in text or "удалён" in text or "remote" in text:
        return "Remote"

    if "гибрид" in text or "hybrid" in text:
        return "Hybrid"

    if "полный день" in text or "full day" in text:
        return "Full day"

    if "гибкий" in text or "flexible" in text:
        return "Flexible"

    if "сменный" in text or "shift" in text:
        return "Shift"

    if "вахтов" in text or "rotational" in text:
        return "Rotational"

    return "Other"


df["employment_clean"] = df["employment"].apply(normalize_employment)
df["schedule_clean"] = df["schedule"].apply(normalize_schedule)


# -----------------------------
# Experience level extraction
# -----------------------------
def extract_experience_level(title):
    text = str(title or "").lower()
    levels = []

    if re.search(r"\b(intern|internship|trainee)\b|стаж[её]р|практикант", text):
        levels.append("Intern")

    if re.search(r"\b(junior|jr)\b|младш|начинающ|без опыта", text):
        levels.append("Junior")

    if re.search(r"\b(middle|mid)\b|средн", text):
        levels.append("Middle")

    if re.search(r"\b(senior|sr)\b|старш|ведущ", text):
        levels.append("Senior")

    if re.search(r"\b(lead|team lead|tech lead|principal|head|architect)\b|тимлид|руковод", text):
        levels.append("Lead")

    levels = list(dict.fromkeys(levels))

    if len(levels) == 0:
        return "Not specified"

    if len(levels) > 1:
        return "Mixed level"

    return levels[0]


df["experience_level"] = df["title"].apply(extract_experience_level)


def detect_resume_experience_level(text):
    text = str(text or "").lower()
    text_clean = re.sub(r"\s+", " ", text)

    no_experience_patterns = [
        r"опыт работы\s*[:\-]?\s*нет",
        r"опыта работы\s*нет",
        r"без опыта",
        r"нет опыта",
        r"no work experience",
        r"no experience",
        r"without experience"
    ]

    for pattern in no_experience_patterns:
        if re.search(pattern, text_clean):
            return "Intern"

    intern_patterns = [
        r"\bfrontend intern\b",
        r"\bbackend intern\b",
        r"\bdata analyst intern\b",
        r"\bqa intern\b",
        r"\bintern\b",
        r"\binternship\b",
        r"\btrainee\b",
        r"стаж[её]р",
        r"стажировка",
        r"практикант"
    ]

    for pattern in intern_patterns:
        if re.search(pattern, text_clean):
            return "Intern"

    student_patterns = [
        r"студент",
        r"студентка",
        r"university",
        r"bachelor",
        r"undergraduate",
        r"информационные системы",
        r"information systems",
        r"2023\s*[-–]\s*2027"
    ]

    has_student_signal = any(re.search(pattern, text_clean) for pattern in student_patterns)

    experience_year_patterns = [
        r"(?:опыт работы|work experience|professional experience|commercial experience|experience)\s*[:\-]?\s*(\d+)\+?\s*(?:years|year|yrs|лет|года|год)",
        r"(\d+)\+?\s*(?:years|year|yrs|лет|года|год)\s*(?:of experience|commercial experience|work experience|professional experience|опыта|опыт работы)"
    ]

    detected_years = []

    for pattern in experience_year_patterns:
        matches = re.findall(pattern, text_clean)

        for match in matches:
            try:
                detected_years.append(int(match))
            except ValueError:
                pass

    if detected_years:
        max_years = max(detected_years)

        if max_years >= 5:
            return "Senior"

        if max_years >= 2:
            return "Middle"

        if max_years >= 1:
            return "Junior"

    if re.search(r"\b(lead|team lead|tech lead|principal|head|architect)\b|тимлид|руковод", text_clean):
        return "Lead"

    if re.search(r"\b(senior|sr)\b|старший разработчик|ведущий разработчик", text_clean):
        return "Senior"

    if re.search(r"\b(middle|mid)\b|middle developer|middle frontend|middle backend", text_clean):
        return "Middle"

    if re.search(r"\b(junior|jr)\b|младший разработчик|начинающий разработчик|beginner|entry level|entry-level", text_clean):
        return "Junior"

    if has_student_signal:
        return "Intern"

    return "Not specified"


# -----------------------------
# Skill preparation
# -----------------------------
def get_clean_skill_list(value):
    skills = str(value or "").lower()
    skills = re.sub(r"[;/|]", ",", skills)
    skills = [s.strip() for s in skills.split(",")]
    skills = [s for s in skills if s and len(s) > 1]
    return skills


df["skill_list"] = df["skills"].apply(get_clean_skill_list)


def row_has_skill(row, skill):
    skill = str(skill or "").lower().strip()

    if not skill:
        return False

    skill_text = " ".join(row.get("skill_list", []))
    search_text = str(row.get("search_text", "")).lower()

    return skill in skill_text or skill in search_text


# -----------------------------
# Career profiles
# -----------------------------
CAREER_PROFILES = {
    "Data Analyst": [
        "sql", "excel", "power bi", "tableau", "python", "pandas",
        "analytics", "data", "dashboard", "bi", "statistics",
        "visualization", "reporting", "business intelligence",
        "анализ данных", "анализу данных", "аналитика", "данные",
        "отчеты", "дашборд", "визуализация данных"
    ],
    "Data Scientist / ML Engineer": [
        "machine learning", "ml", "deep learning", "pytorch", "tensorflow",
        "sklearn", "scikit", "nlp", "computer vision", "bert", "model",
        "statistics", "python", "pandas", "numpy", "data science",
        "машинное обучение", "машинного обучения", "нейронные сети",
        "модели", "искусственный интеллект"
    ],
    "Backend Developer": [
        "python", "java", "spring", "fastapi", "django", "flask",
        "node", "api", "rest", "postgresql", "mysql", "sql",
        "backend", "microservices", "docker", "redis", "database",
        "бэкенд", "разработчик", "серверная часть", "база данных"
    ],
    "Frontend Developer": [
        "html", "css", "javascript", "typescript", "react", "vue",
        "angular", "frontend", "ui", "ux", "responsive", "web",
        "фронтенд", "веб интерфейс", "верстка", "адаптивный дизайн"
    ],
    "DevOps Engineer": [
        "docker", "kubernetes", "linux", "ci/cd", "jenkins",
        "terraform", "ansible", "nginx", "devops", "cloud",
        "monitoring", "deployment"
    ],
    "QA Engineer": [
        "qa", "testing", "selenium", "test", "autotest",
        "postman", "pytest", "quality assurance", "manual testing",
        "automation testing", "тестирование", "тестировщик"
    ],
    "Mobile Developer": [
        "android", "ios", "kotlin", "swift", "flutter",
        "react native", "mobile", "мобильная разработка"
    ],
    "Cybersecurity Specialist": [
        "security", "cybersecurity", "owasp", "pentest", "siem",
        "network security", "information security", "кибербезопасность",
        "информационная безопасность"
    ],
    "Project / Product Manager": [
        "product", "project", "agile", "scrum", "jira", "manager",
        "requirements", "roadmap", "stakeholders", "business analysis",
        "проект", "продукт", "менеджер"
    ]
}

CAREER_PROFILE_TEXTS = {
    profession: " ".join(skills)
    for profession, skills in CAREER_PROFILES.items()
}

dataset_skills = []

for skills in df["skill_list"]:
    dataset_skills.extend(skills)

DATASET_SKILLS = sorted(set(dataset_skills))

ALL_SKILLS = sorted(set(
    skill
    for skills in CAREER_PROFILES.values()
    for skill in skills
) | set(DATASET_SKILLS))


# -----------------------------
# Resume reading
# -----------------------------
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
            return ""

    return raw.decode("utf-8", errors="ignore")


# -----------------------------
# Lightweight TF-IDF + cosine similarity
# -----------------------------
STOPWORDS = {
    "the", "and", "or", "a", "an", "to", "of", "for", "in", "on", "with",
    "by", "from", "at", "as", "is", "are", "was", "were", "be", "been",
    "this", "that", "it", "you", "your", "we", "our", "their", "will",
    "can", "using", "use", "used", "about", "into", "over", "under",
    "за", "и", "в", "на", "с", "по", "для", "от", "до", "как", "это",
    "женщина", "мужчина", "лет", "родилась", "родился"
}


def tokenize_for_ml(text):
    tokens = re.findall(r"[a-zA-Zа-яА-Я0-9+#.]+", str(text).lower())
    tokens = [t for t in tokens if len(t) > 1 and t not in STOPWORDS]
    return tokens


def build_tfidf_vectors(documents, max_features=12000):
    tokenized_docs = [tokenize_for_ml(doc) for doc in documents]

    total_counts = Counter()

    for tokens in tokenized_docs:
        total_counts.update(tokens)

    vocabulary = set([token for token, _ in total_counts.most_common(max_features)])

    doc_freq = Counter()

    for tokens in tokenized_docs:
        unique_tokens = set(t for t in tokens if t in vocabulary)
        doc_freq.update(unique_tokens)

    n_docs = len(documents)
    idf = {}

    for token in vocabulary:
        idf[token] = math.log((1 + n_docs) / (1 + doc_freq[token])) + 1

    vectors = []

    for tokens in tokenized_docs:
        filtered = [t for t in tokens if t in vocabulary]
        counts = Counter(filtered)
        total = max(len(filtered), 1)

        vector = {}

        for token, count in counts.items():
            tf = count / total
            vector[token] = tf * idf[token]

        vectors.append(vector)

    return vectors


def cosine_similarity_dict(vec_a, vec_b):
    if not vec_a or not vec_b:
        return 0.0

    common = set(vec_a.keys()) & set(vec_b.keys())
    numerator = sum(vec_a[t] * vec_b[t] for t in common)

    norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
    norm_b = math.sqrt(sum(v * v for v in vec_b.values()))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return numerator / (norm_a * norm_b)


def detect_skills(text):
    text_lower = str(text).lower()
    detected = []

    for skill in ALL_SKILLS:
        skill = str(skill).lower().strip()

        if not skill:
            continue

        if skill in text_lower:
            detected.append(skill)

    return sorted(set(detected))


def keyword_profile_scores(text):
    text_lower = str(text or "").lower()
    scores = {}

    for profession, keywords in CAREER_PROFILES.items():
        score = 0
        max_score = 0

        for kw in keywords:
            weight = 2 if " " in kw else 1
            max_score += weight

            if kw in text_lower:
                score += weight

        scores[profession] = score / max_score if max_score else 0

    return scores


def recommend_profession_ml(text):
    text = str(text or "").strip()

    if not text:
        return "Not enough data", 0, []

    professions = list(CAREER_PROFILE_TEXTS.keys())
    profile_docs = [CAREER_PROFILE_TEXTS[p] for p in professions]
    documents = profile_docs + [text]

    vectors = build_tfidf_vectors(documents, max_features=7000)
    resume_vector = vectors[-1]
    profile_vectors = vectors[:-1]

    keyword_scores = keyword_profile_scores(text)

    final_scores = {}

    for idx, profession in enumerate(professions):
        semantic_score = cosine_similarity_dict(resume_vector, profile_vectors[idx])
        keyword_score = keyword_scores.get(profession, 0)
        final_score = (semantic_score * 0.70) + (keyword_score * 0.30)
        final_scores[profession] = final_score

    top = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
    best_profession, best_score = top[0]

    if best_score <= 0:
        return "Junior IT Specialist", 25, []

    confidence = int(round(min(96, max(35, best_score * 180))))

    top_profession_scores = [
        {
            "profession": profession,
            "score": int(round(min(99, score * 180)))
        }
        for profession, score in top[:5]
    ]

    return best_profession, confidence, top_profession_scores


def recommend_learning_path(profession, detected_skills, missing_skills, experience_level):
    detected = set(detected_skills)
    missing = list(missing_skills)

    advice = []

    if experience_level in ["Intern", "Junior", "Not specified"]:
        advice.append("Build a portfolio with 2–3 practical projects related to the recommended profession.")
    elif experience_level == "Middle":
        advice.append("Strengthen production-level tools, architecture, testing, and deployment skills.")
    elif experience_level in ["Senior", "Lead"]:
        advice.append("Emphasize system design, leadership, mentoring, and measurable business impact.")

    if profession == "Data Analyst":
        advice.append("Focus on SQL, dashboards, statistics, data visualization, and business storytelling.")
    elif profession == "Backend Developer":
        advice.append("Focus on API design, databases, Docker, caching, and microservices.")
    elif profession == "Frontend Developer":
        advice.append("Focus on HTML, CSS, JavaScript, responsive UI, and React basics.")
    elif profession == "Data Scientist / ML Engineer":
        advice.append("Focus on ML projects, model evaluation, NLP/CV, and model deployment.")
    elif profession == "DevOps Engineer":
        advice.append("Focus on Docker, Kubernetes, CI/CD, Linux, monitoring, and cloud tools.")
    elif profession == "QA Engineer":
        advice.append("Focus on test automation, Postman, Selenium/Pytest, and bug reporting.")
    else:
        advice.append("Improve the missing skills and connect them with real projects.")

    if missing:
        advice.append("Priority skills to learn next: " + ", ".join(missing[:5]) + ".")

    if not detected:
        advice.append("Add a clear skills section to your resume so the system can detect your strengths better.")

    return advice[:4]


def match_jobs_ml(text, detected_skills, limit=8):
    text = str(text or "").strip()

    if not text:
        return []

    vacancy_docs = df["search_text"].fillna("").astype(str).tolist()
    documents = [text] + vacancy_docs

    vectors = build_tfidf_vectors(documents, max_features=12000)
    resume_vector = vectors[0]
    vacancy_vectors = vectors[1:]

    similarities = [
        cosine_similarity_dict(resume_vector, vacancy_vector)
        for vacancy_vector in vacancy_vectors
    ]

    candidates = []

    for idx, row in df.iterrows():
        score = float(similarities[idx])

        if score <= 0:
            continue

        row_text = (
            str(row.get("skills", "")) + " " +
            str(row.get("description_clean", "")) + " " +
            str(row.get("title", ""))
        ).lower()

        required_skills = [
            skill for skill in ALL_SKILLS
            if skill and skill in row_text
        ]

        matched_skills = sorted(set(required_skills) & set(detected_skills))
        missing_skills = sorted(set(required_skills) - set(detected_skills))[:6]

        candidates.append({
            "row": row,
            "score": score,
            "matched_skills": matched_skills[:8],
            "missing_skills": missing_skills
        })

    candidates = sorted(
        candidates,
        key=lambda x: (
            x["score"],
            0 if pd.isna(x["row"]["salary_kzt"]) else x["row"]["salary_kzt"]
        ),
        reverse=True
    )[:limit]

    results = []

    for item in candidates:
        row = item["row"]
        match_score = int(round(min(99, max(1, item["score"] * 180))))

        results.append({
            "title": row["title"],
            "company": row["company"],
            "city": row["city"],
            "salary": format_salary(row["salary_kzt"]),
            "salary_raw": None if pd.isna(row["salary_kzt"]) else int(row["salary_kzt"]),
            "url": row.get("url", ""),
            "description": row["description_clean"][:380] + ("..." if len(row["description_clean"]) > 380 else ""),
            "matched_skills": item["matched_skills"],
            "skills_to_improve": item["missing_skills"],
            "match_score": match_score,
            "experience_level": row.get("experience_level", "Not specified")
        })

    return results


def score_profession_row(row, profession, detected_skills):
    row_text = str(row.get("search_text", "")).lower()
    title_text = str(row.get("title", "")).lower()
    profile_keywords = CAREER_PROFILES.get(profession, [])
    detected_set = set(detected_skills)

    score = 0

    for word in re.findall(r"[a-zA-Z]+", profession.lower()):
        if len(word) > 2 and word in row_text:
            score += 2.0

    for keyword in profile_keywords:
        keyword = str(keyword).lower().strip()

        if not keyword:
            continue

        if keyword in row_text:
            score += 1.2 if " " in keyword else 0.8

    for skill in detected_set:
        skill = str(skill).lower().strip()

        if skill and skill in row_text:
            score += 0.5

    if profession == "Data Analyst":
        if "analyst" in title_text or "аналитик" in title_text or "bi" in title_text:
            score += 3.0

    elif profession == "Backend Developer":
        if "backend" in title_text or "back-end" in title_text or "developer" in title_text or "разработчик" in title_text:
            score += 3.0

    elif profession == "Frontend Developer":
        if "frontend" in title_text or "front-end" in title_text or "react" in title_text or "vue" in title_text:
            score += 3.0

    elif profession == "Data Scientist / ML Engineer":
        if "data scientist" in title_text or "machine learning" in title_text or "ml" in title_text or "машин" in title_text:
            score += 3.0

    elif profession == "DevOps Engineer":
        if "devops" in title_text or "sre" in title_text or "system engineer" in title_text:
            score += 3.0

    elif profession == "QA Engineer":
        if "qa" in title_text or "tester" in title_text or "testing" in title_text or "тест" in title_text:
            score += 3.0

    elif profession == "Mobile Developer":
        if "mobile" in title_text or "android" in title_text or "ios" in title_text or "flutter" in title_text:
            score += 3.0

    elif profession == "Cybersecurity Specialist":
        if "security" in title_text or "cyber" in title_text or "information security" in title_text:
            score += 3.0

    elif profession == "Project / Product Manager":
        if "product manager" in title_text or "project manager" in title_text or "scrum" in title_text:
            score += 3.0

    return score


def predict_salary_potential(profession, detected_skills, experience_level, matching_vacancies):
    salary_df = df[df["salary_kzt"].notna()].copy()

    if salary_df.empty:
        return None

    salary_df["profession_score"] = salary_df.apply(
        lambda row: score_profession_row(row, profession, detected_skills),
        axis=1
    )

    profession_rows = salary_df[salary_df["profession_score"] >= 2.0].copy()

    if profession_rows.empty:
        profession_rows = salary_df.sort_values("profession_score", ascending=False).head(50).copy()

    level_used = experience_level
    used_lower_band = False

    if experience_level == "Intern":
        exact_rows = profession_rows[profession_rows["experience_level"] == "Intern"].copy()
        entry_rows = profession_rows[profession_rows["experience_level"].isin(["Intern", "Junior"])].copy()
        junior_rows = profession_rows[profession_rows["experience_level"] == "Junior"].copy()

        if len(exact_rows) >= 2:
            level_rows = exact_rows
            level_used = "Intern"
        elif len(entry_rows) >= 3:
            level_rows = entry_rows
            level_used = "Intern/Junior"
        elif len(junior_rows) >= 2:
            level_rows = junior_rows
            level_used = "Junior fallback"
        else:
            level_rows = profession_rows.copy()
            level_used = "lower salary band for entry-level estimate"
            used_lower_band = True

    elif experience_level == "Junior":
        exact_rows = profession_rows[profession_rows["experience_level"] == "Junior"].copy()
        entry_rows = profession_rows[profession_rows["experience_level"].isin(["Junior", "Intern"])].copy()

        if len(exact_rows) >= 2:
            level_rows = exact_rows
            level_used = "Junior"
        elif len(entry_rows) >= 3:
            level_rows = entry_rows
            level_used = "Junior/Intern"
        else:
            level_rows = profession_rows.copy()
            level_used = "lower salary band for junior estimate"
            used_lower_band = True

    elif experience_level == "Middle":
        exact_rows = profession_rows[profession_rows["experience_level"] == "Middle"].copy()

        if len(exact_rows) >= 3:
            level_rows = exact_rows
            level_used = "Middle"
        else:
            level_rows = profession_rows.copy()
            level_used = "profession average because Middle data is limited"

    elif experience_level == "Senior":
        exact_rows = profession_rows[profession_rows["experience_level"] == "Senior"].copy()
        senior_rows = profession_rows[profession_rows["experience_level"].isin(["Senior", "Lead"])].copy()

        if len(exact_rows) >= 3:
            level_rows = exact_rows
            level_used = "Senior"
        elif len(senior_rows) >= 3:
            level_rows = senior_rows
            level_used = "Senior/Lead"
        else:
            level_rows = profession_rows.copy()
            level_used = "profession average because Senior data is limited"

    elif experience_level == "Lead":
        lead_rows = profession_rows[profession_rows["experience_level"].isin(["Lead", "Senior"])].copy()

        if len(lead_rows) >= 3:
            level_rows = lead_rows
            level_used = "Lead/Senior"
        else:
            level_rows = profession_rows.copy()
            level_used = "profession average because Lead data is limited"

    else:
        level_rows = profession_rows.copy()
        level_used = "profession average"

    salaries = level_rows["salary_kzt"].dropna().tolist()

    if not salaries:
        return None

    sorted_salaries = sorted(salaries)

    def percentile(values, p):
        if not values:
            return None

        k = (len(values) - 1) * p
        lower = math.floor(k)
        upper = math.ceil(k)

        if lower == upper:
            return values[int(k)]

        return values[lower] * (upper - k) + values[upper] * (k - lower)

    if used_lower_band:
        predicted_salary = int(round(percentile(sorted_salaries, 0.25), 0))
        low = int(round(percentile(sorted_salaries, 0.10), 0))
        high = int(round(percentile(sorted_salaries, 0.40), 0))
    else:
        predicted_salary = int(round(sum(salaries) / len(salaries), 0))
        low = int(round(percentile(sorted_salaries, 0.25), 0))
        high = int(round(percentile(sorted_salaries, 0.75), 0))

    if experience_level in ["Intern", "Junior"]:
        method = (
            f"Prediction is calculated from {profession} vacancies filtered by entry-level experience "
            f"({level_used}). Middle, Senior, and Lead salaries are excluded when entry-level data is available."
        )
    elif experience_level != "Not specified":
        method = (
            f"Prediction is calculated from {profession} vacancies filtered by detected experience level: "
            f"{level_used}."
        )
    else:
        method = (
            f"Prediction is calculated from salary-specified vacancies related to {profession}, "
            f"because resume experience level was not clearly detected."
        )

    return {
        "predicted_salary": predicted_salary,
        "range_low": low,
        "range_high": high,
        "based_on": len(salaries),
        "method": method
    }


def calculate_salary_impact_for_skills(
    profession,
    detected_skills,
    skills_to_improve,
    salary_potential,
    experience_level
):
    salary_df = df[df["salary_kzt"].notna()].copy()

    if salary_df.empty or not skills_to_improve:
        return {
            "baseline_salary": salary_potential.get("predicted_salary") if salary_potential else None,
            "items": [],
            "note": "Not enough salary data to calculate salary impact."
        }

    salary_df["profession_score"] = salary_df.apply(
        lambda row: score_profession_row(row, profession, detected_skills),
        axis=1
    )

    profession_rows = salary_df[salary_df["profession_score"] >= 2.0].copy()

    if profession_rows.empty:
        profession_rows = salary_df.sort_values("profession_score", ascending=False).head(80).copy()

    if salary_potential and salary_potential.get("predicted_salary"):
        baseline_salary = int(salary_potential.get("predicted_salary"))
    elif not profession_rows.empty:
        baseline_salary = int(round(profession_rows["salary_kzt"].mean(), 0))
    else:
        baseline_salary = None

    if not baseline_salary:
        return {
            "baseline_salary": None,
            "items": [],
            "note": "Not enough salary data to calculate salary impact."
        }

    if experience_level == "Intern":
        comparable_levels = ["Intern", "Junior"]
        max_growth_percent = 0.30
    elif experience_level == "Junior":
        comparable_levels = ["Intern", "Junior"]
        max_growth_percent = 0.40
    elif experience_level == "Middle":
        comparable_levels = ["Middle"]
        max_growth_percent = 0.60
    elif experience_level == "Senior":
        comparable_levels = ["Senior", "Lead"]
        max_growth_percent = 0.70
    elif experience_level == "Lead":
        comparable_levels = ["Lead", "Senior"]
        max_growth_percent = 0.70
    else:
        comparable_levels = ["Intern", "Junior"]
        max_growth_percent = 0.30

    level_pool = profession_rows[
        profession_rows["experience_level"].isin(comparable_levels)
    ].copy()

    if len(level_pool) < 3:
        level_pool = salary_df[
            salary_df["experience_level"].isin(comparable_levels)
        ].copy()

    if len(level_pool) < 3:
        return {
            "baseline_salary": int(baseline_salary),
            "items": [],
            "note": "Not enough entry-level salary data to calculate safe salary impact."
        }

    impact_items = []

    for skill in skills_to_improve[:10]:
        skill = str(skill).lower().strip()

        if not skill:
            continue

        with_skill = level_pool[
            level_pool.apply(lambda row: row_has_skill(row, skill), axis=1)
        ].copy()

        without_skill = level_pool[
            ~level_pool.apply(lambda row: row_has_skill(row, skill), axis=1)
        ].copy()

        if len(with_skill) < 2:
            continue

        avg_with_skill_raw = int(round(with_skill["salary_kzt"].mean(), 0))

        if len(without_skill) >= 2:
            avg_without_skill = int(round(without_skill["salary_kzt"].mean(), 0))
        else:
            avg_without_skill = baseline_salary

        raw_growth = avg_with_skill_raw - baseline_salary
        market_gap = avg_with_skill_raw - avg_without_skill
        growth = max(raw_growth, market_gap, 0)

        if growth <= 0:
            continue

        max_allowed_growth = int(round(baseline_salary * max_growth_percent, 0))
        safe_growth = min(growth, max_allowed_growth)

        if safe_growth <= 0:
            continue

        safe_salary_with_skill = baseline_salary + safe_growth

        impact_items.append({
            "skill": skill,
            "current_estimate": int(baseline_salary),
            "avg_with_skill": int(safe_salary_with_skill),
            "potential_growth": int(safe_growth),
            "market_gap": int(market_gap),
            "based_on": int(len(with_skill))
        })

    impact_items = sorted(
        impact_items,
        key=lambda x: x["potential_growth"],
        reverse=True
    )[:5]

    if not impact_items:
        return {
            "baseline_salary": int(baseline_salary),
            "items": [],
            "note": "The dataset does not show a safe positive salary difference for the suggested skills at this experience level."
        }

    return {
        "baseline_salary": int(baseline_salary),
        "items": impact_items,
        "note": "Salary impact is calculated only within comparable experience level vacancies."
    }


def format_salary(value):
    if pd.isna(value) or value is None:
        return "Not specified"

    return f"{int(value):,} ₸".replace(",", " ")


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
# Analytics API
# -----------------------------
@app.route("/api/skills")
def skills():
    skills_series = df["skills"].str.split(",").explode().fillna("")
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


@app.route("/api/salary-quality")
def salary_quality():
    with_salary = int(df["salary_kzt"].notna().sum())
    without_salary = int(df["salary_kzt"].isna().sum())

    return jsonify({
        "With salary": with_salary,
        "Without salary": without_salary
    })


@app.route("/api/cities")
def cities():
    return jsonify(df["city"].value_counts().head(10).to_dict())


@app.route("/api/employment")
def employment():
    order = [
        "Full-time",
        "Part-time",
        "Project work",
        "Not specified"
    ]

    counts = (
        df["employment_clean"]
        .value_counts()
        .reindex(order, fill_value=0)
    )

    counts = counts[counts > 0]

    return jsonify(counts.astype(int).to_dict())


@app.route("/api/schedule")
def schedule():
    order = [
        "Full day",
        "Remote",
        "Hybrid",
        "Flexible",
        "Shift",
        "Rotational",
        "Not specified"
    ]

    counts = (
        df["schedule_clean"]
        .value_counts()
        .reindex(order, fill_value=0)
    )

    counts = counts[counts > 0]

    return jsonify(counts.astype(int).to_dict())


@app.route("/api/experience")
def experience():
    order = ["Intern", "Junior", "Middle", "Senior", "Lead"]

    counts = (
        df[df["experience_level"].isin(order)]["experience_level"]
        .value_counts()
        .reindex(order, fill_value=0)
    )

    counts = counts[counts > 0]

    return jsonify(counts.astype(int).to_dict())


@app.route("/api/experience-salary")
def experience_salary():
    order = ["Intern", "Junior", "Middle", "Senior", "Lead"]

    salary_by_level = (
        df[df["experience_level"].isin(order)]
        .groupby("experience_level")["salary_kzt"]
        .mean()
        .reindex(order)
        .dropna()
        .round(0)
        .astype(int)
    )

    return jsonify(salary_by_level.to_dict())


@app.route("/api/skill-options")
def skill_options():
    all_skills = []

    for skills in df["skill_list"]:
        all_skills.extend(skills)

    if not all_skills:
        return jsonify([])

    skill_counts = pd.Series(all_skills)
    skill_counts = skill_counts[skill_counts != ""]

    top_skills = (
        skill_counts
        .value_counts()
        .head(45)
        .index
        .tolist()
    )

    return jsonify(top_skills)


@app.route("/api/characteristics-kpis")
def characteristics_kpis():
    total_jobs = len(df)

    junior_keywords_pattern = (
        r"\b(junior|jr|intern|internship|trainee)\b|"
        r"стаж[её]р|стажировка|практикант|начинающ|без опыта"
    )

    junior_friendly_count = 0
    skill_counts_per_job = []

    for _, row in df.iterrows():
        title_text = str(row.get("title", "")).lower()
        skills_list = row.get("skill_list", [])

        clean_skills = [
            s for s in skills_list
            if s and str(s).strip()
        ]

        skill_counts_per_job.append(len(clean_skills))

        has_junior_title = bool(re.search(junior_keywords_pattern, title_text))
        has_short_skill_list = len(clean_skills) > 0 and len(clean_skills) < 3

        if has_junior_title or has_short_skill_list:
            junior_friendly_count += 1

    junior_accessibility = round((junior_friendly_count / total_jobs) * 100, 1) if total_jobs else 0

    remote_pattern = r"удален|удалён|дистанц|remote|home office|work from home|wfh"

    remote_count = 0

    for _, row in df.iterrows():
        schedule_text = str(row.get("schedule", "")).lower()
        description_text = str(row.get("description_clean", "")).lower()
        search_text = str(row.get("search_text", "")).lower()

        combined_text = schedule_text + " " + description_text + " " + search_text

        if re.search(remote_pattern, combined_text):
            remote_count += 1

    remote_flexibility = round((remote_count / total_jobs) * 100, 1) if total_jobs else 0

    salary_count = int(df["salary_kzt"].notna().sum())
    salary_transparency = round((salary_count / total_jobs) * 100, 1) if total_jobs else 0

    skills_density = round(sum(skill_counts_per_job) / total_jobs, 2) if total_jobs else 0

    return jsonify({
        "junior_accessibility": {
            "value": junior_accessibility,
            "count": junior_friendly_count
        },
        "remote_flexibility": {
            "value": remote_flexibility,
            "count": remote_count
        },
        "salary_transparency": {
            "value": salary_transparency,
            "count": salary_count
        },
        "skills_density": {
            "value": skills_density
        }
    })


@app.route("/api/skill-clusters")
def skill_clusters():
    selected_skill = request.args.get("skill", "").lower().strip()
    limit = int(request.args.get("limit", 5))

    if not selected_skill:
        return jsonify({
            "skill": "",
            "total_jobs": 0,
            "related_skills": {}
        })

    matched_rows = df[df.apply(lambda row: row_has_skill(row, selected_skill), axis=1)]

    related = []

    for skills in matched_rows["skill_list"]:
        for skill in skills:
            skill = skill.lower().strip()

            if skill and skill != selected_skill:
                related.append(skill)

    if not related:
        return jsonify({
            "skill": selected_skill,
            "total_jobs": int(len(matched_rows)),
            "related_skills": {}
        })

    related_counts = pd.Series(related)

    top_related = (
        related_counts
        .value_counts()
        .head(limit)
        .astype(int)
        .to_dict()
    )

    return jsonify({
        "skill": selected_skill,
        "total_jobs": int(len(matched_rows)),
        "related_skills": top_related
    })


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
def jobs_list():
    return jsonify(sorted(df["title"].dropna().unique().tolist()))


# -----------------------------
# AI Career Assistant API
# -----------------------------
@app.route("/api/career-assistant", methods=["POST"])
def career_assistant():
    resume_text = extract_resume_text(request.files.get("resume"))
    combined_text = resume_text.strip()

    if not combined_text:
        return jsonify({
            "recommended_profession": "Not enough data",
            "confidence": 0,
            "experience_level": "Not specified",
            "detected_skills": [],
            "skills_to_improve": [],
            "matching_vacancies": [],
            "top_profession_scores": [],
            "career_advice": [
                "Please upload a text-based resume in .txt or .pdf format."
            ],
            "salary_potential": None,
            "salary_impact": None,
            "note": "No readable resume text was provided."
        })

    profession, confidence, top_profession_scores = recommend_profession_ml(combined_text)
    detected = detect_skills(combined_text)
    experience_level = detect_resume_experience_level(combined_text)

    profile = CAREER_PROFILES.get(profession, [])
    missing_profile_skills = sorted(set(profile) - set(detected))[:8]

    matching_vacancies = match_jobs_ml(
        combined_text,
        detected_skills=detected,
        limit=8
    )

    salary_potential = predict_salary_potential(
        profession=profession,
        detected_skills=detected,
        experience_level=experience_level,
        matching_vacancies=matching_vacancies
    )

    salary_impact = calculate_salary_impact_for_skills(
        profession=profession,
        detected_skills=detected,
        skills_to_improve=missing_profile_skills,
        salary_potential=salary_potential,
        experience_level=experience_level
    )

    career_advice = recommend_learning_path(
        profession=profession,
        detected_skills=detected,
        missing_skills=missing_profile_skills,
        experience_level=experience_level
    )

    return jsonify({
        "recommended_profession": profession,
        "confidence": confidence,
        "experience_level": experience_level,
        "detected_skills": detected[:25],
        "skills_to_improve": missing_profile_skills,
        "matching_vacancies": matching_vacancies,
        "top_profession_scores": top_profession_scores,
        "career_advice": career_advice,
        "salary_potential": salary_potential,
        "salary_impact": salary_impact,
        "note": "ML-style assistant: lightweight TF-IDF + cosine similarity + skill gap + salary prediction + salary impact."
    })


@app.route("/api/classify")
def classify():
    text = request.args.get("text", "")
    profession, confidence, _ = recommend_profession_ml(text)

    return jsonify({
        "prediction": profession,
        "confidence": confidence
    })


if __name__ == "__main__":
    app.run(debug=True)