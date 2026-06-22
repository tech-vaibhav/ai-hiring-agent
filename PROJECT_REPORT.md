# AI Hiring Agent - Project Documentation

## 1. Project Idea & Overview
The **AI Hiring Agent** is an automated, intelligent recruitment pipeline designed to streamline the hiring process. It evaluates candidate resumes against job descriptions (JDs) using advanced AI models. The system automates the ingestion of PDF documents, extracts structured technical and professional information, and performs a comprehensive fit analysis. 

The ultimate goal is to provide recruiters with a data-driven **Evaluation Result** consisting of a fit score, hiring decision (e.g., "Strong Hire", "Hire with Training", "Reject"), identified strengths, gaps, and potential red flags, thereby reducing manual screening time and mitigating human bias.

---

## 2. Technology Stack & Third-Party Integrations
The project is built on a modern, scalable, and AI-first technology stack:

### Core Frameworks & Libraries
*   **Backend Framework:** FastAPI (Python) - For building high-performance APIs.
*   **AI Framework:** LangChain - Used to orchestrate LLM prompts, chains, and structured output parsing.
*   **Data Validation:** Pydantic - Ensures rigorous schema validation for AI outputs and API endpoints.
*   **PDF Processing:** `pdfplumber` - For extracting raw text from uploaded PDF resumes and job descriptions.

### Third-Party Services
*   **LLM Provider (Google Gemini):** Uses `gemini-2.5-flash` via `langchain-google-genai` as the core reasoning engine for all AI agents.
*   **Database (Neon / PostgreSQL):** A serverless PostgreSQL database used to store structured data (Job Roles, Candidates, and Evaluations) using the `psycopg2` driver.
*   **Storage (Supabase):** Used for secure, private object storage of the uploaded PDF files (resumes and JDs).

---

## 3. The Agents
The system employs specialized AI agents, each assigned a specific cognitive task within the pipeline. They utilize LangChain's `PydanticOutputParser` to ensure responses strictly adhere to predefined JSON schemas.

1.  **JD Agent (`app/agents/jd_agent.py`)**
    *   **Role:** Extracts structured information from raw Job Description text.
    *   **Outputs:** Role Title, Must-have skills, Nice-to-have skills, Experience level, and Role type (intern, full-time).
2.  **Resume Agent (`app/agents/resume_agent.py`)**
    *   **Role:** Analyzes raw text extracted from a candidate's resume.
    *   **Outputs:** Technical skills, Experience summary, Projects, Experience level, and purely factual red flags.
3.  **Fit Agent (`app/agents/fit_agent.py`)**
    *   **Role:** The core evaluator. It takes the parsed Job Description and parsed Candidate Profile as inputs and compares them.
    *   **Outputs:** An `EvaluationResult` containing a fit score (0.0 to 1.0), a definitive decision, specific strengths matching the JD, skill/experience gaps, and identified risks.
4.  **Decision Agent (`app/agents/decision_agent.py`)**
    *   *Note: Currently a placeholder for future complex orchestration or multi-stage decision logic.*

---

## 4. Full Project Structure
```text
ai-hiring-agent/
│
├── app/
│   ├── agents/                 # AI Reasoning modules
│   │   ├── decision_agent.py   
│   │   ├── fit_agent.py        # Evaluates candidate vs JD
│   │   ├── jd_agent.py         # Parses JD text
│   │   └── resume_agent.py     # Parses Resume text
│   │
│   ├── api/                    # FastAPI Routes
│   │   └── routes.py           # API endpoints (e.g., /ping)
│   │
│   ├── db/                     # Database Connection & Operations
│   │   ├── neon.py             # PostgreSQL connection logic
│   │   ├── queries.py          # SQL INSERT/SELECT queries
│   │   └── test_connection.py
│   │
│   ├── pipeline/               # Core Business Logic & Orchestration
│   │   ├── evaluator.py        # Connects DB records to the Fit Agent
│   │   ├── ingest.py           # Handles file uploads to Supabase
│   │   ├── jd_parser.py        # E2E JD processing flow
│   │   ├── orchestrator.py     # Batch processing for rate-limit management
│   │   ├── preprocess.py       # PDF text extraction and cleaning
│   │   └── resume_parser.py    # E2E Resume processing flow
│   │
│   ├── prompts/                # LangChain System Prompts
│   │   ├── fit_prompt.py
│   │   ├── jd_prompt.py
│   │   └── resume_prompt.py
│   │
│   ├── schemas/                # Pydantic Data Models
│   │   ├── evaluation.py
│   │   ├── evaluation_llm.py
│   │   ├── jd.py
│   │   └── resume.py
│   │
│   ├── storage/                # Cloud Storage Integration
│   │   └── supabase.py         # Upload/Download PDF bytes
│   │
│   ├── config.py               # Environment variable management
│   └── main.py                 # FastAPI application entry point
│
├── data/                       # Local data/logs directory
├── requirements.txt            # Python dependencies
└── .env                        # Environment configuration (Keys/URLs)
```

---

## 5. In-Depth Detail: The Workflow Pipeline

The system operates in a highly modular, step-by-step pipeline:

### Phase 1: Ingestion (`ingest.py`)
1.  A user uploads a JD PDF or a batch of Resume PDFs via the API.
2.  Unique IDs (`role_id` and `candidate_id`) are generated.
3.  The raw PDF bytes are uploaded securely to Supabase Storage.

### Phase 2: Preprocessing & Parsing (`jd_parser.py` & `resume_parser.py`)
1.  The PDF is temporarily downloaded from Supabase to the local environment.
2.  `pdfplumber` (`preprocess.py`) extracts text and cleans it (removing weird whitespace, formatting bullet points).
3.  The cleaned text is sent to the respective AI Agent (JD Agent or Resume Agent).
4.  The Agent returns a strictly typed JSON object (enforced by Pydantic).
5.  This structured data is permanently saved to the Neon PostgreSQL database via `queries.py`.
6.  The temporary local PDF and the Supabase storage object are deleted (cleaning up resources).

### Phase 3: Orchestration (`orchestrator.py`)
*   When processing many resumes, the orchestrator groups them into batches (e.g., 4 at a time) and enforces sleep intervals. This prevents hitting rate limits on the Gemini API.

### Phase 4: Evaluation (`evaluator.py`)
1.  The system fetches a structured Job Role and a structured Candidate Profile from the database.
2.  Both are fed into the **Fit Agent**.
3.  The Gemini model conducts a nuanced comparison based on strict guidelines (being fair, realistic, and conservative).
4.  The final `EvaluationResult` is written back to the `evaluations` table in PostgreSQL.

---

## 6. What Results Will It Generate?

For every candidate processed against a specific job role, the system generates a highly detailed, structured report stored in the database. 

An example result looks like this logically:

```json
{
  "candidate_id": "cand_8f7b2a1c",
  "role_id": "role_da2026",
  "fit_score": 0.85,
  "decision": "Strong Hire",
  "strengths": [
    "5 years of Python/FastAPI experience matching JD requirement.",
    "Strong background in LLM integration and LangChain.",
    "Experience with serverless PostgreSQL."
  ],
  "gaps": [
    "No explicit mention of Kubernetes deployment experience."
  ],
  "red_flags": [
    "Short 3-month stint at previous startup."
  ],
  "evaluated_at": "2026-04-28T17:35:00Z"
}
```

### Business Value
*   **Speed:** Evaluates hundreds of resumes in minutes.
*   **Standardization:** Every candidate is judged against the exact same rubric (the parsed JD parameters).
*   **Actionable Insights:** Recruiters don't just get a "score"; they get explicit reasons (strengths/gaps) to guide their interview questions.
