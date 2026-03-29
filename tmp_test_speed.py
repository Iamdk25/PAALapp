from main import AGENT_ROSTER
import time
from dotenv import load_dotenv

load_dotenv()

from tasks import TASK_BUILDERS

def test():
    print("Starting retrieval latency test...")
    
    # Run 1 (Cold start)
    t0 = time.time()
    tasks1 = TASK_BUILDERS["explain"](
        topic="derivatives", 
        course="test_course_101", 
        chat_history=[]
    )
    t1 = time.time()
    print(f"Run 1 (Cold) Task building took: {t1 - t0:.3f} seconds")
    
    # Run 2 (Warm start - should be cached)
    t2 = time.time()
    tasks2 = TASK_BUILDERS["explain"](
        topic="derivatives", 
        course="test_course_101", 
        chat_history=[]
    )
    t3 = time.time()
    print(f"Run 2 (Warm) Task building took: {t3 - t2:.3f} seconds")

if __name__ == "__main__":
    test()
