'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [db, setDb] = useState({ tasks: [], quizzes: [] });
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); // login, admin, student_dashboard, create_quiz, take_quiz, result
  const [currentTask, setCurrentTask] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);

  // Form states
  const [roleInput, setRoleInput] = useState('student');
  const [nameInput, setNameInput] = useState('');
  
  // Admin forms
  const [taskForm, setTaskForm] = useState({ subject: '', topic: '', count: 5, time: 10 });
  
  // Student forms
  const [quizForm, setQuizForm] = useState([]);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  
  // Quiz taking
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const tasks = JSON.parse(localStorage.getItem('qp_tasks') || '[]');
    const quizzes = JSON.parse(localStorage.getItem('qp_quizzes') || '[]');
    setDb({ tasks, quizzes });
  }, []);

  const saveDb = (newDb) => {
    localStorage.setItem('qp_tasks', JSON.stringify(newDb.tasks));
    localStorage.setItem('qp_quizzes', JSON.stringify(newDb.quizzes));
    setDb(newDb);
  };

  const login = () => {
    if (roleInput === 'student' && !nameInput.trim()) {
      alert('Please enter your name');
      return;
    }
    const user = { role: roleInput, name: roleInput === 'admin' ? 'Admin' : nameInput.trim() };
    setCurrentUser(user);
    setView(roleInput === 'admin' ? 'admin' : 'student_dashboard');
  };

  const logout = () => {
    setCurrentUser(null);
    setView('login');
  };

  // ADMIN
  const createTask = () => {
    if (!taskForm.subject || !taskForm.topic || taskForm.count < 1 || taskForm.time < 1) {
      alert('Please fill all fields');
      return;
    }
    const newDb = { ...db };
    newDb.tasks.push({
      id: Date.now().toString(),
      ...taskForm,
      createdAt: new Date().toISOString()
    });
    saveDb(newDb);
    setTaskForm({ subject: '', topic: '', count: 5, time: 10 });
  };

  // STUDENT - CREATE
  const startCreateQuiz = (task) => {
    setCurrentTask(task);
    const initialForm = Array.from({ length: task.count }, () => ({
      text: '', options: ['', '', '', ''], correctIndex: 0
    }));
    setQuizForm(initialForm);
    setView('create_quiz');
  };

  const processBulk = () => {
    if (!bulkText.trim()) return;
    const blocks = bulkText.split(/\n\s*\n/);
    let qIndex = 0;
    const newQuizForm = [...quizForm];

    blocks.forEach(block => {
      if (qIndex >= currentTask.count) return;
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      let question = "";
      let options = [];
      let ansIndex = 0;

      lines.forEach(line => {
        const l = line.toLowerCase();
        if (l.startsWith('ans:') || l.startsWith('answer:')) {
            let ansChar = line.split(':')[1].trim().toLowerCase();
            if (ansChar === 'a' || ansChar === '1') ansIndex = 0;
            else if (ansChar === 'b' || ansChar === '2') ansIndex = 1;
            else if (ansChar === 'c' || ansChar === '3') ansIndex = 2;
            else if (ansChar === 'd' || ansChar === '4') ansIndex = 3;
            else ansIndex = (parseInt(ansChar) || 1) - 1;
        } 
        else if (l.match(/^[a-d][\.\)]/)) options.push(line.replace(/^[a-dA-D][\.\)]\s*/, ''));
        else if (l.match(/^[1-4][\.\)]/)) options.push(line.replace(/^[1-4][\.\)]\s*/, ''));
        else if (l.startsWith('q:') || l.match(/^\d+[\.\)]/)) question = line.replace(/^(q:|\d+[\.\)])\s*/i, '');
        else if (!question) question = line;
      });

      if (question) {
        newQuizForm[qIndex] = {
          text: question,
          options: [options[0]||'', options[1]||'', options[2]||'', options[3]||''],
          correctIndex: ansIndex
        };
        qIndex++;
      }
    });
    setQuizForm(newQuizForm);
    alert(`Auto-filled ${qIndex} questions!`);
    setShowBulk(false);
  };

  const publishQuiz = () => {
    // Validate
    for (let i=0; i<quizForm.length; i++) {
      const q = quizForm[i];
      if (!q.text || q.options.some(o => !o) || q.correctIndex < 0 || q.correctIndex > 3) {
        alert(`Please fill Question ${i+1} properly`);
        return;
      }
    }
    const newDb = { ...db };
    newDb.quizzes.push({
      id: Date.now().toString(),
      taskId: currentTask.id,
      creatorName: currentUser.name,
      questions: quizForm,
      ratings: [],
      avgRating: 0,
      createdAt: new Date().toISOString()
    });
    saveDb(newDb);
    alert('Quiz Published!');
    setView('student_dashboard');
  };

  // STUDENT - TAKE QUIZ
  const startTakeQuiz = (quiz) => {
    setCurrentQuiz(quiz);
    const task = db.tasks.find(t => t.id === quiz.taskId);
    setTimeRemaining(task.time * 60);
    setSelectedAnswers({});
    setView('take_quiz');
  };

  useEffect(() => {
    let timer;
    if (view === 'take_quiz' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [view, timeRemaining]);

  const submitExam = () => {
    let s = 0;
    currentQuiz.questions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correctIndex) s++;
    });
    setScore(s);
    setRating(0);
    setView('result');
  };

  const submitRating = () => {
    if (!rating) {
      alert("Please select a rating!");
      return;
    }
    const newDb = { ...db };
    const idx = newDb.quizzes.findIndex(q => q.id === currentQuiz.id);
    newDb.quizzes[idx].ratings.push(rating);
    const sum = newDb.quizzes[idx].ratings.reduce((a,b)=>a+b, 0);
    newDb.quizzes[idx].avgRating = sum / newDb.quizzes[idx].ratings.length;
    saveDb(newDb);
    alert("Thanks for rating!");
    setView('student_dashboard');
  };

  // Renders
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      {currentUser && (
        <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
          <h1 className="text-xl font-bold">Quiz Platform</h1>
          <div className="flex items-center gap-4">
            <span>Hello, {currentUser.name}</span>
            <button onClick={logout} className="border border-white px-3 py-1 rounded hover:bg-white hover:text-indigo-600 transition">Logout</button>
          </div>
        </nav>
      )}

      <main className="max-w-4xl mx-auto p-4 py-8">
        {/* LOGIN */}
        {view === 'login' && (
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Welcome</h2>
            <div className="mb-4">
              <label className="block mb-1 font-semibold">Role</label>
              <select value={roleInput} onChange={e=>setRoleInput(e.target.value)} className="w-full border p-2 rounded">
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {roleInput === 'student' && (
              <div className="mb-6">
                <label className="block mb-1 font-semibold">Name</label>
                <input type="text" value={nameInput} onChange={e=>setNameInput(e.target.value)} className="w-full border p-2 rounded" placeholder="Your name" />
              </div>
            )}
            <button onClick={login} className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 font-bold transition">Enter</button>
          </div>
        )}

        {/* ADMIN VIEW */}
        {view === 'admin' && (
          <div>
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-bold mb-4 text-indigo-600">Create New Task</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block font-semibold">Subject</label><input type="text" value={taskForm.subject} onChange={e=>setTaskForm({...taskForm, subject: e.target.value})} className="w-full border p-2 rounded" /></div>
                <div><label className="block font-semibold">Topic</label><input type="text" value={taskForm.topic} onChange={e=>setTaskForm({...taskForm, topic: e.target.value})} className="w-full border p-2 rounded" /></div>
                <div><label className="block font-semibold">Questions count</label><input type="number" value={taskForm.count} onChange={e=>setTaskForm({...taskForm, count: +e.target.value})} className="w-full border p-2 rounded" /></div>
                <div><label className="block font-semibold">Time (mins)</label><input type="number" value={taskForm.time} onChange={e=>setTaskForm({...taskForm, time: +e.target.value})} className="w-full border p-2 rounded" /></div>
              </div>
              <button onClick={createTask} className="bg-emerald-500 text-white px-6 py-2 rounded hover:bg-emerald-600 font-bold">Assign Task</button>
            </div>

            <h2 className="text-xl font-bold mb-4">Active Tasks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...db.tasks].reverse().map(t => (
                <div key={t.id} className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="font-bold text-indigo-600">{t.subject}</h3>
                  <p>Topic: {t.topic}</p>
                  <p className="text-sm text-gray-500 mt-2">{t.count} Qs | {t.time} Mins</p>
                  <span className="inline-block mt-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">
                    {db.quizzes.filter(q=>q.taskId===t.id).length} Quizzes
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STUDENT DASHBOARD */}
        {view === 'student_dashboard' && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-indigo-600">Top Rated Live Quizzes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[...db.quizzes].sort((a,b)=>(b.avgRating||0)-(a.avgRating||0)).map(q => {
                const task = db.tasks.find(t => t.id === q.taskId);
                if(!task) return null;
                return (
                  <div key={q.id} className="bg-white p-4 rounded-lg shadow border">
                    <h3 className="font-bold text-indigo-600">{task.subject}: {task.topic}</h3>
                    <p className="text-sm text-gray-500 my-1">By {q.creatorName} | {task.time} Mins</p>
                    <p className="text-sm font-bold text-yellow-600 mb-3">{q.avgRating ? `⭐ ${q.avgRating.toFixed(1)} (${q.ratings.length})` : 'No ratings'}</p>
                    <button onClick={()=>startTakeQuiz(q)} className="bg-indigo-600 text-white px-4 py-1 rounded text-sm hover:bg-indigo-700">Take Exam</button>
                  </div>
                )
              })}
            </div>

            <h2 className="text-xl font-bold mb-4 text-indigo-600 border-t pt-8">Pending Tasks from Admin</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...db.tasks].reverse().map(t => (
                <div key={t.id} className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="font-bold text-indigo-600">{t.subject}</h3>
                  <p>Topic: {t.topic}</p>
                  <p className="text-sm text-gray-500 my-2">{t.count} Qs | {t.time} Mins</p>
                  <button onClick={()=>startCreateQuiz(t)} className="bg-emerald-500 text-white px-4 py-1 rounded text-sm hover:bg-emerald-600">Create Quiz</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STUDENT CREATE QUIZ */}
        {view === 'create_quiz' && currentTask && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <button onClick={()=>setView('student_dashboard')} className="text-indigo-600 mb-4">&larr; Back</button>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">Create Quiz: {currentTask.subject}</h2>
                <p className="text-gray-500">Topic: {currentTask.topic} | {currentTask.count} Qs</p>
              </div>
              <button onClick={()=>setShowBulk(!showBulk)} className="bg-gray-200 px-3 py-1 rounded font-bold hover:bg-gray-300">Bulk Import</button>
            </div>

            {showBulk && (
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded mb-6">
                <p className="text-sm mb-2 text-indigo-800">Paste questions (Q: ... A) ... B) ... C) ... D) ... Ans: A)</p>
                <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} className="w-full p-2 border rounded mb-2 h-32" />
                <button onClick={processBulk} className="bg-indigo-600 text-white px-4 py-1 rounded text-sm">Auto-fill</button>
              </div>
            )}

            {quizForm.map((q, i) => (
              <div key={i} className="bg-gray-50 p-4 rounded border mb-4">
                <h4 className="font-bold mb-2">Question {i+1}</h4>
                <input type="text" value={q.text} onChange={e=>{const f=[...quizForm]; f[i].text=e.target.value; setQuizForm(f)}} className="w-full border p-2 rounded mb-2" placeholder="Question text" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[0,1,2,3].map(optIdx => (
                    <input key={optIdx} type="text" value={q.options[optIdx]} onChange={e=>{const f=[...quizForm]; f[i].options[optIdx]=e.target.value; setQuizForm(f)}} className="w-full border p-2 rounded text-sm" placeholder={`Option ${optIdx+1}`} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold">Correct Option (1-4):</label>
                  <select value={q.correctIndex} onChange={e=>{const f=[...quizForm]; f[i].correctIndex=+e.target.value; setQuizForm(f)}} className="border p-1 rounded">
                    <option value={0}>1</option><option value={1}>2</option><option value={2}>3</option><option value={3}>4</option>
                  </select>
                </div>
              </div>
            ))}
            <button onClick={publishQuiz} className="bg-emerald-500 text-white px-6 py-2 rounded font-bold w-full hover:bg-emerald-600">Publish Quiz</button>
          </div>
        )}

        {/* STUDENT TAKE QUIZ */}
        {view === 'take_quiz' && currentQuiz && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-indigo-600">Exam mode</h2>
              <div className="text-2xl font-bold text-red-500">
                {Math.floor(timeRemaining/60).toString().padStart(2,'0')}:{(timeRemaining%60).toString().padStart(2,'0')}
              </div>
            </div>

            {currentQuiz.questions.map((q, i) => (
              <div key={i} className="mb-6 p-4 bg-gray-50 rounded border">
                <h4 className="font-bold mb-3">{i+1}. {q.text}</h4>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <label key={optIdx} className="block p-3 bg-white border rounded cursor-pointer hover:bg-indigo-50">
                      <input type="radio" name={`q_${i}`} checked={selectedAnswers[i] === optIdx} onChange={()=>setSelectedAnswers({...selectedAnswers, [i]: optIdx})} className="mr-2" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={submitExam} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold w-full hover:bg-indigo-700">Submit Answers</button>
          </div>
        )}

        {/* RESULT */}
        {view === 'result' && (
          <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2">Quiz Completed!</h2>
            <div className="text-6xl font-bold text-indigo-600 my-6">{score}/{currentQuiz?.questions.length}</div>
            
            <div className="border-t pt-6 mt-4">
              <h3 className="font-bold mb-2">Rate this quiz</h3>
              <div className="flex justify-center flex-row-reverse gap-2 text-3xl mb-4">
                {[5,4,3,2,1].map(star => (
                  <span key={star} onClick={()=>setRating(star)} className={`cursor-pointer ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                ))}
              </div>
              <button onClick={submitRating} className="bg-emerald-500 text-white px-6 py-2 rounded font-bold w-full hover:bg-emerald-600">Submit Rating & Home</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
