from flask import Flask, render_template, jsonify, request
import pandas as pd

app = Flask(__name__)

df = pd.read_csv("jobs.csv")

# --- Очистка данных ---
df.rename(columns={"name": "title"}, inplace=True)

# Средняя зарплата
df["salary"] = (df["salary_from"] + df["salary_to"]) / 2
df["salary"] = df["salary"].fillna(df["salary_from"])
df["salary"] = df["salary"].fillna(df["salary_to"])

# Нормализация навыков: убираем пробелы
df["skills"] = df["skills"].fillna("")

# Нормализация города
df["city"] = df["city"].fillna("Не указан")
df["title"] = df["title"].fillna("Без названия")
df["company"] = df["company"].fillna("Не указана")

# Конвертация зарплат в KZT (приблизительно)
RUB_TO_KZT = 5.5
USD_TO_KZT = 450

def to_kzt(row):
    salary = row["salary"]
    currency = str(row.get("currency", "KZT")).upper()
    if pd.isna(salary):
        return None
    if currency == "RUR" or currency == "RUB":
        return salary * RUB_TO_KZT
    elif currency == "USD":
        return salary * USD_TO_KZT
    return salary  # уже KZT

df["salary_kzt"] = df.apply(to_kzt, axis=1)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/api/skills")
def skills():
    skills = df["skills"].str.split(",").explode()
    skills = skills.str.strip().str.lower()
    skills = skills[skills != ""]
    top = skills.value_counts().head(15).to_dict()
    return jsonify(top)


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
    city_counts = df["city"].value_counts().head(10).to_dict()
    return jsonify(city_counts)


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
    filtered = filtered.iloc[(page - 1) * per_page : page * per_page]

    result = filtered[["title", "company", "salary_kzt", "city", "url"]].copy()
    result = result.rename(columns={"salary_kzt": "salary"})
    result["salary"] = result["salary"].apply(
        lambda x: f"{int(x):,} ₸" if pd.notna(x) else "Не указана"
    )

    return jsonify({
        "jobs": result.to_dict(orient="records"),
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    })


@app.route("/api/jobs/list")
def jobs_list():
    titles = sorted(df["title"].dropna().unique().tolist())
    return jsonify(titles)


@app.route("/api/classify")
def classify():
    text = request.args.get("text", "").lower()

    categories = {
        "Data Science / ML": ["machine learning", "data science", "data analyst", "pandas", "numpy", "tensorflow", "pytorch", "sklearn", "нейронн", "ml", "аналитик данных"],
        "Frontend": ["react", "javascript", "typescript", "vue", "angular", "css", "html", "frontend", "фронтенд"],
        "Backend": ["django", "fastapi", "flask", "backend", "бэкенд", "python", "node.js", "java", "golang", "rest api"],
        "DevOps": ["devops", "kubernetes", "docker", "ci/cd", "terraform", "ansible", "jenkins"],
        "Mobile": ["android", "ios", "swift", "kotlin", "flutter", "react native", "мобильн"],
        "QA": ["qa", "тестировщик", "selenium", "testing", "автотест"],
        "Security": ["безопасность", "cybersecurity", "кибербезопасность", "owasp", "pentest"],
    }

    scores = {}
    for category, keywords in categories.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[category] = score

    if scores:
        result = max(scores, key=scores.get)
    else:
        result = "Другое"

    return jsonify({"prediction": result})


if __name__ == "__main__":
    app.run(debug=True)
