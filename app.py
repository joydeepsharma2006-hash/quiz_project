# ============================================================
#  app.py  –  Quiz App Backend (Flask)
#  Run:  python app.py
#  Then open:  http://127.0.0.1:5000
# ============================================================

from flask import Flask, render_template, request, jsonify, session
import requests
import html
import random

app = Flask(__name__)
app.secret_key = "quiz_secret_key_123"


# ── Home page ──────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ── Test route: visit http://127.0.0.1:5000/test to confirm Flask is working ──
@app.route("/test")
def test():
    return jsonify({"status": "Flask is working fine!"})


# ── Fetch questions ──────────────────────────────────────────
@app.route("/get_questions")
def get_questions():
    category   = request.args.get("category",   "9")
    difficulty = request.args.get("difficulty", "medium")
    amount     = request.args.get("amount",     "10")

    api_url = (
        f"https://opentdb.com/api.php"
        f"?amount={amount}"
        f"&category={category}"
        f"&difficulty={difficulty}"
        f"&type=multiple"
    )

    print(f"[INFO] Fetching from: {api_url}")  # shows in your terminal

    try:
        response = requests.get(api_url, timeout=15)
        data = response.json()
        print(f"[INFO] API response_code: {data.get('response_code')}")
    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out")
        return jsonify({"error": "The trivia API timed out. Please try again."}), 500
    except requests.exceptions.ConnectionError:
        print("[ERROR] No internet / connection refused")
        return jsonify({"error": "Cannot reach the trivia API. Check your internet connection."}), 500
    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    if data.get("response_code") != 0:
        msg = {
            1: "No results – try fewer questions or a different category.",
            2: "Invalid parameter sent to the API.",
            3: "Token not found.",
            4: "Token empty – all questions used up. Try again later.",
        }.get(data.get("response_code"), "Unknown API error.")
        return jsonify({"error": msg}), 400

    cleaned_questions = []
    for q in data["results"]:
        correct  = html.unescape(q["correct_answer"])
        options  = [html.unescape(a) for a in q["incorrect_answers"]] + [correct]
        random.shuffle(options)
        cleaned_questions.append({
            "question":   html.unescape(q["question"]),
            "category":   html.unescape(q["category"]),
            "difficulty": q["difficulty"],
            "options":    options,
            "correct":    correct,
        })

    session["questions"]    = cleaned_questions
    session["score"]        = 0
    session["total"]        = len(cleaned_questions)
    session["user_answers"] = []

    questions_for_frontend = [
        {
            "question":   q["question"],
            "category":   q["category"],
            "difficulty": q["difficulty"],
            "options":    q["options"],
        }
        for q in cleaned_questions
    ]

    print(f"[INFO] Sending {len(questions_for_frontend)} questions to frontend")
    return jsonify({"questions": questions_for_frontend})


# ── Check answer ─────────────────────────────────────────────
@app.route("/check_answer", methods=["POST"])
def check_answer():
    data   = request.get_json()
    index  = data.get("index")
    chosen = data.get("answer", "")

    questions = session.get("questions", [])

    if not questions:
        return jsonify({"error": "Session expired. Please refresh and start again."}), 400

    if index is None or index >= len(questions):
        return jsonify({"error": "Invalid question index."}), 400

    correct  = questions[index]["correct"]
    is_right = (chosen == correct)

    if is_right:
        session["score"] = session.get("score", 0) + 1

    user_answers = session.get("user_answers", [])
    user_answers.append({
        "question": questions[index]["question"],
        "chosen":   chosen,
        "correct":  correct,
        "is_right": is_right,
    })
    session["user_answers"] = user_answers
    session.modified = True

    return jsonify({"is_right": is_right, "correct": correct})


# ── Get results ──────────────────────────────────────────────
@app.route("/get_results")
def get_results():
    return jsonify({
        "score":        session.get("score", 0),
        "total":        session.get("total", 0),
        "user_answers": session.get("user_answers", []),
    })


# ── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)