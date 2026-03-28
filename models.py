from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    # clerk_user_id (e.g. user_2... )
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, index=True) # References User.id
    course = Column(String, index=True)
    role = Column(String)  # 'user' or 'assistant'
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class QuizScore(Base):
    __tablename__ = "quiz_scores"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, index=True)
    course = Column(String, index=True)
    topic = Column(String)
    score = Column(String) # e.g., '4/5'
    timestamp = Column(DateTime, default=datetime.utcnow)
