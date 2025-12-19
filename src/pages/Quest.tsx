import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { House } from "../lib/houses";
import { HOUSES } from "../lib/houses";
import { QUEST } from "../lib/quest";

export default function Quest() {
  const navigate = useNavigate();
  const { house } = useParams<{ house?: string }>();
  const safeHouse: House = (house as House) || "alfie";
  const questions = QUEST[safeHouse] ?? QUEST["alfie"];

  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const q = questions[step];

  const pick = (questionId: string, answer: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setScore((prev) => prev + value);
    const nextStep = step + 1;
    if (nextStep >= questions.length) {
      navigate(`/result/${safeHouse}`, {
        state: {
          score: score + value,
          answers: { ...answers, [questionId]: answer },
        },
      });
    } else {
      setStep(nextStep);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">{HOUSES[safeHouse].label}</h2>
        <div className="mb-2">
          Question {step + 1} / {questions.length}
        </div>
        <div className="mb-4 font-semibold">{q.title}</div>
        <div className="grid gap-3">
          {q.choices.map((c) => (
            <button
              key={c.answer}
              onClick={() => pick(q.id, c.answer, c.value)}
              className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
