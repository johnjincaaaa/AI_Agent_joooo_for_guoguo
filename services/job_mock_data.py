"""BOSS 直聘风格虚拟岗位数据（后期可替换为开放接口）。"""

RESUME_TEMPLATES = [
    {
        "id": "classic",
        "name": "经典简约",
        "description": "通用结构，突出经历与技能，适合多数岗位",
    },
    {
        "id": "technical",
        "name": "技术专项",
        "description": "强调项目与技术栈，适合开发/测试/运维",
    },
    {
        "id": "campus",
        "name": "应届生",
        "description": "突出教育背景与实习，适合校招",
    },
]

MOCK_JOBS = [
    {
        "id": "boss_10001",
        "title": "Java开发工程师",
        "company": "字节跳动",
        "salary": "20-35K",
        "city": "北京",
        "experience": "3-5年",
        "education": "本科",
        "tags": ["Java", "Spring Boot", "MySQL", "Redis"],
        "description": "负责后端业务开发，参与微服务架构设计与性能优化。",
        "url": "https://www.zhipin.com/job_detail/e1a2b3c4d5.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10002",
        "title": "Java后端开发",
        "company": "美团",
        "salary": "18-30K",
        "city": "北京",
        "experience": "1-3年",
        "education": "本科",
        "tags": ["Java", "Spring Cloud", "Kafka", "MySQL"],
        "description": "参与外卖/到店核心业务，负责高并发接口开发与稳定性保障。",
        "url": "https://www.zhipin.com/job_detail/f2b3c4d5e6.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10003",
        "title": "初级Java工程师",
        "company": "快手",
        "salary": "12-18K",
        "city": "北京",
        "experience": "1-3年",
        "education": "本科",
        "tags": ["Java", "MyBatis", "Linux", "Git"],
        "description": "参与服务端功能开发，配合完成需求评审、编码与联调。",
        "url": "https://www.zhipin.com/job_detail/a3c4d5e6f7.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10004",
        "title": "Python开发工程师",
        "company": "小红书",
        "salary": "15-25K",
        "city": "上海",
        "experience": "1-3年",
        "education": "本科",
        "tags": ["Python", "Django", "MySQL", "爬虫"],
        "description": "负责数据平台与业务脚本开发，参与接口设计与文档维护。",
        "url": "https://www.zhipin.com/job_detail/b4d5e6f7a8.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10005",
        "title": "全栈开发工程师",
        "company": "有料科技",
        "salary": "15-22K",
        "city": "杭州",
        "experience": "3-5年",
        "education": "本科",
        "tags": ["Java", "Vue", "FastAPI", "MySQL"],
        "description": "独立负责前后端功能迭代，参与 AI 应用产品化落地。",
        "url": "https://www.zhipin.com/job_detail/c5e6f7a8b9.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10006",
        "title": "Java实习生",
        "company": "阿里巴巴",
        "salary": "200-300/天",
        "city": "杭州",
        "experience": "在校/应届",
        "education": "本科",
        "tags": ["Java", "Spring", "计算机基础", "数据结构"],
        "description": "参与电商核心模块开发，导师带教，提供转正机会。",
        "url": "https://www.zhipin.com/job_detail/d6f7a8b9c0.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10007",
        "title": "测试开发工程师",
        "company": "腾讯",
        "salary": "16-28K",
        "city": "深圳",
        "experience": "1-3年",
        "education": "本科",
        "tags": ["Java", "自动化测试", "Python", "CI/CD"],
        "description": "负责测试平台与自动化框架建设，保障版本质量。",
        "url": "https://www.zhipin.com/job_detail/e7a8b9c0d1.html",
        "source": "BOSS直聘",
    },
    {
        "id": "boss_10008",
        "title": "后端开发工程师",
        "company": "京东",
        "salary": "18-32K",
        "city": "北京",
        "experience": "3-5年",
        "education": "本科",
        "tags": ["Java", "分布式", "Elasticsearch", "Docker"],
        "description": "负责物流/零售相关业务后端，参与大促稳定性保障。",
        "url": "https://www.zhipin.com/job_detail/f8b9c0d1e2.html",
        "source": "BOSS直聘",
    },
]


def _split_keywords(text: str) -> set:
    if not text:
        return set()
    parts = []
    for chunk in text.replace("，", ",").replace("、", ",").split(","):
        chunk = chunk.strip().lower()
        if chunk:
            parts.append(chunk)
    return set(parts)


def match_jobs(profile: dict, resume: str = "", limit: int = 8) -> list:
    """基于画像与简历对虚拟岗位打分排序。"""
    target_role = (profile.get("target_role") or "").lower()
    target_city = (profile.get("target_city") or "").lower()
    skills = _split_keywords(profile.get("skills") or "")
    skill_blob = " ".join(skills)
    resume_lower = (resume or profile.get("preset_resume") or "").lower()

    scored = []
    for job in MOCK_JOBS:
        score = 0
        reasons = []

        title_lower = job["title"].lower()
        city_lower = job["city"].lower()
        job_tags = [t.lower() for t in job["tags"]]
        job_blob = " ".join([job["title"], job["description"], " ".join(job["tags"])]).lower()

        if target_role and (target_role in title_lower or any(k in title_lower for k in target_role.split())):
            score += 35
            reasons.append("岗位匹配")

        if target_city and target_city in city_lower:
            score += 20
            reasons.append("城市匹配")

        matched_skills = [t for t in job_tags if t in skill_blob or t in resume_lower]
        if matched_skills:
            score += min(30, len(matched_skills) * 10)
            reasons.append(f"技能命中：{', '.join(matched_skills[:3])}")

        exp = profile.get("experience_years") or ""
        if exp and exp in job.get("experience", ""):
            score += 10
            reasons.append("经验匹配")

        if score == 0:
            score = 15
            reasons.append("综合推荐")

        scored.append({
            **job,
            "match_score": min(score, 99),
            "match_reason": "；".join(reasons),
        })

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored[:limit]
