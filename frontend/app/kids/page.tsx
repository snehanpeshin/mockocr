"use client";

import {
  Baby,
  Brush,
  Check,
  Eraser,
  Heart,
  Home,
  Lock,
  Paintbrush,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Settings,
  Shapes,
  Sparkles,
  Star,
  Undo2,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useAuth } from "../lib/auth";

type KidsActivity = "draw" | "letters" | "numbers" | "shapes" | "name" | "gallery";
type Tool = "pen" | "eraser";
type StrokePoint = { x: number; y: number };
type Stroke = { color: string; points: StrokePoint[]; size: number; tool: Tool };

type KidsCreation = {
  activityType: string;
  childAge?: string;
  childId: string;
  childName: string;
  createdAt: string;
  image: string;
  source: "kids-mode";
  title: string;
  type: string;
};

type ChildProfile = {
  age: string;
  avatar: string;
  id: string;
  name: string;
};

const KIDS_CREATIONS_KEY = "cleanote.kidsCreations";
const KIDS_PROFILES_KEY = "cleanote.kidsProfiles";
const SAVED_NOTES_KEY = "cleanote.savedNotes";

const COLORS = ["#26324a", "#f05f5f", "#2f80ed", "#14a88b", "#ffb84d", "#8f3ff2"];
const SIZES = [8, 14, 22];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBERS = "0123456789".split("");
const SHAPES = ["Circle", "Square", "Triangle", "Rectangle", "Star", "Heart"];
const ENCOURAGEMENT = ["Great job!", "Beautiful!", "Nice work!", "You did it!"];

const DEFAULT_CHILDREN: ChildProfile[] = [
  { age: "4", avatar: "A", id: "aarav", name: "Aarav" },
  { age: "6", avatar: "M", id: "maya", name: "Maya" }
];

const PROMPTS = [
  "Draw a house",
  "Write your name",
  "Draw three circles",
  "Write the letter A",
  "Draw your family",
  "Make a tiny map"
];

const ACTIVITIES = [
  {
    id: "draw" as KidsActivity,
    icon: Paintbrush,
    label: "Draw Anything",
    note: "Blank canvas"
  },
  {
    id: "letters" as KidsActivity,
    icon: Pencil,
    label: "Practice Letters",
    note: "Trace A-Z"
  },
  {
    id: "numbers" as KidsActivity,
    icon: Star,
    label: "Practice Numbers",
    note: "Trace 0-9"
  },
  {
    id: "shapes" as KidsActivity,
    icon: Shapes,
    label: "Learn Shapes",
    note: "Trace simple shapes"
  },
  {
    id: "name" as KidsActivity,
    icon: Baby,
    label: "Practice My Name",
    note: PRACTICE_NAME
  },
  {
    id: "gallery" as KidsActivity,
    icon: Heart,
    label: "My Art",
    note: "Saved privately"
  }
];

export default function KidsModePage() {
  const { user, isAuthLoading, logout } = useAuth();
  const [children, setChildren] = useState<ChildProfile[]>(DEFAULT_CHILDREN);
  const [selectedChildId, setSelectedChildId] = useState(DEFAULT_CHILDREN[0].id);
  const [activity, setActivity] = useState<KidsActivity>("draw");
  const [letterIndex, setLetterIndex] = useState(0);
  const [numberIndex, setNumberIndex] = useState(0);
  const [shapeIndex, setShapeIndex] = useState(0);
  const [creations, setCreations] = useState<KidsCreation[]>([]);
  const [celebration, setCelebration] = useState("Create something wonderful.");
  const [showParentGate, setShowParentGate] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [gateProgress, setGateProgress] = useState(0);
  const gateTimerRef = useRef<number | null>(null);

  const selectedChild = children.find((child) => child.id === selectedChildId) ?? children[0] ?? DEFAULT_CHILDREN[0];
  const activityTitle = getActivityTitle(activity, letterIndex, numberIndex, shapeIndex, selectedChild.name);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KIDS_CREATIONS_KEY);
      setCreations(stored ? (JSON.parse(stored) as KidsCreation[]) : []);
    } catch {
      setCreations([]);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KIDS_PROFILES_KEY);
      if (!stored) {
        return;
      }
      const parsedProfiles = JSON.parse(stored) as ChildProfile[];
      const validProfiles = parsedProfiles
        .filter((profile) => profile.id && profile.name.trim())
        .slice(0, 4);
      if (validProfiles.length) {
        setChildren(validProfiles);
        setSelectedChildId((currentId) =>
          validProfiles.some((profile) => profile.id === currentId) ? currentId : validProfiles[0].id
        );
      }
    } catch {
      setChildren(DEFAULT_CHILDREN);
    }
  }, []);

  function updateChildName(childId: string, name: string) {
    const safeName = name.slice(0, 18);
    setChildren((currentChildren) => {
      const nextChildren = currentChildren.map((child) =>
        child.id === childId
          ? {
              ...child,
              avatar: getAvatarLetter(safeName, child.avatar),
              name: safeName
            }
          : child
      );
      window.localStorage.setItem(KIDS_PROFILES_KEY, JSON.stringify(nextChildren));
      return nextChildren;
    });
  }

  function addChildProfile() {
    setChildren((currentChildren) => {
      if (currentChildren.length >= 4) {
        return currentChildren;
      }
      const nextNumber = currentChildren.length + 1;
      const nextProfile: ChildProfile = {
        age: "",
        avatar: "K",
        id: `kid-${Date.now()}`,
        name: `Kid ${nextNumber}`
      };
      const nextChildren = [...currentChildren, nextProfile];
      window.localStorage.setItem(KIDS_PROFILES_KEY, JSON.stringify(nextChildren));
      setSelectedChildId(nextProfile.id);
      return nextChildren;
    });
  }

  function saveCreation(image: string) {
    const now = new Date().toISOString();
    const nextCreation: KidsCreation = {
      activityType: activity,
      childAge: selectedChild.age,
      childId: selectedChild.id,
      childName: selectedChild.name,
      createdAt: now,
      image,
      source: "kids-mode",
      title: activityTitle,
      type: activity === "draw" ? "free-drawing" : `${activity}-tracing`
    };
    const nextCreations = [nextCreation, ...creations].slice(0, 40);
    setCreations(nextCreations);
    window.localStorage.setItem(KIDS_CREATIONS_KEY, JSON.stringify(nextCreations));
    saveParentMemoryNote(nextCreation);
    setCelebration(`${ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)]} Saved for parent review.`);
  }

  function startParentHold() {
    setShowParentGate(true);
    setGateProgress(0);
    if (gateTimerRef.current) {
      window.clearInterval(gateTimerRef.current);
    }
    gateTimerRef.current = window.setInterval(() => {
      setGateProgress((current) => {
        const next = Math.min(100, current + 4);
        if (next >= 100 && gateTimerRef.current) {
          window.clearInterval(gateTimerRef.current);
          window.location.href = "/app";
        }
        return next;
      });
    }, 120);
  }

  function stopParentHold() {
    if (gateTimerRef.current) {
      window.clearInterval(gateTimerRef.current);
      gateTimerRef.current = null;
    }
    setGateProgress(0);
  }

  return (
    <main className="kids-mode-shell">
      <header className="kids-topbar">
        <a className="kids-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote Kids</span>
        </a>
        <nav aria-label="Kids Mode">
          <button onClick={() => setActivity("draw")} type="button">
            Create
          </button>
          <button onClick={() => setActivity("letters")} type="button">
            Learn
          </button>
          <button onClick={() => setActivity("gallery")} type="button">
            My Art
          </button>
          <button className="parent-gate-button" onClick={() => setShowParentGate(true)} type="button">
            <Lock aria-hidden="true" size={18} />
            Parent Area
          </button>
        </nav>
      </header>

      <section className="kids-hero">
        <div>
          <p className="kids-kicker">Create. Learn. Save. Remember.</p>
          <h1>Kids Mode</h1>
          <p>
            Draw, trace, and save favorite creations in a calm space made for little hands.
          </p>
          <div className="kids-sticker-row" aria-hidden="true">
            <span>ABC</span>
            <span>123</span>
            <span>★</span>
            <span>♡</span>
          </div>
        </div>
        <ChildSelector
          children={children}
          selectedChildId={selectedChildId}
          onSelect={setSelectedChildId}
          onOpenSettings={() => setShowProfileSettings(true)}
        />
      </section>

      <section className="kids-layout">
        <aside className="kids-activity-grid" aria-label="Kids activities">
          {ACTIVITIES.map(({ icon: Icon, id, label, note }) => (
            <button
              className={activity === id ? "kids-activity-card active" : "kids-activity-card"}
              key={id}
              onClick={() => setActivity(id)}
              type="button"
            >
              <Icon aria-hidden="true" size={30} />
              <span>{label}</span>
              <small>{note}</small>
            </button>
          ))}
        </aside>

        <section className="kids-workspace">
          {activity === "gallery" ? (
            <KidsGallery creations={creations} childName={selectedChild.name} />
          ) : (
            <>
              <div className="kids-workspace-header">
                <div>
                  <p className="kids-kicker">{selectedChild.name}&apos;s activity</p>
                  <h2>{activityTitle}</h2>
                </div>
                <div className="celebration-pill">
                  <Sparkles aria-hidden="true" size={18} />
                  {celebration}
                </div>
              </div>
              <DrawingCanvas
                activity={activity}
                guideLabel={activityTitle}
                onNext={() => {
                  if (activity === "letters") {
                    setLetterIndex((current) => (current + 1) % LETTERS.length);
                  } else if (activity === "numbers") {
                    setNumberIndex((current) => (current + 1) % NUMBERS.length);
                  } else if (activity === "shapes") {
                    setShapeIndex((current) => (current + 1) % SHAPES.length);
                  }
                  setCelebration("Ready for the next one.");
                }}
                onSave={saveCreation}
                shape={SHAPES[shapeIndex]}
                template={
                  activity === "letters"
                    ? LETTERS[letterIndex]
                    : activity === "numbers"
                      ? NUMBERS[numberIndex]
                      : activity === "name"
                        ? selectedChild.name
                        : ""
                }
              />
            </>
          )}
        </section>
      </section>

      <section className="cleanote-board-prompts" aria-label="Physical Cleanote board prompts">
        <div>
          <p className="kids-kicker">Try this on your Cleanote Board</p>
          <h2>Screen-light practice, saved later by a parent.</h2>
          <p>Saved drawings appear in Parent Mode so families can review progress beside scanned notes.</p>
        </div>
        <div className="prompt-row">
          {PROMPTS.map((prompt) => (
            <span key={prompt}>{prompt}</span>
          ))}
        </div>
      </section>

      {showParentGate ? (
        <div className="parent-gate" role="dialog" aria-modal="true" aria-label="Parent gate">
          <div className="parent-gate-card">
            <Lock aria-hidden="true" size={34} />
            <h2>Parent Area</h2>
            <AccountStatus isAuthLoading={isAuthLoading} userEmail={user?.email ?? null} onLogout={logout} />
            <p>Hold the button for 3 seconds to leave Kids Mode.</p>
            <button
              onPointerDown={startParentHold}
              onPointerLeave={stopParentHold}
              onPointerUp={stopParentHold}
              type="button"
            >
              Hold to exit
            </button>
            <div className="parent-gate-track">
              <span style={{ width: `${gateProgress}%` }} />
            </div>
            <button className="parent-gate-cancel" onClick={() => setShowParentGate(false)} type="button">
              Back to Kids Mode
            </button>
          </div>
        </div>
      ) : null}

      {showProfileSettings ? (
        <div className="parent-gate" role="dialog" aria-modal="true" aria-label="Kid profiles">
          <div className="parent-gate-card kids-profile-card">
            <Settings aria-hidden="true" size={34} />
            <h2>Kid Profiles</h2>
            <p>Use first names or nicknames. Profiles and drawings are saved privately in this browser.</p>
            <div className="kids-profile-list">
              {children.map((child) => (
                <label key={child.id}>
                  <span>{child.avatar}</span>
                  <input
                    aria-label={`Name for ${child.name}`}
                    maxLength={18}
                    onChange={(event) => updateChildName(child.id, event.target.value)}
                    value={child.name}
                  />
                </label>
              ))}
            </div>
            <button
              className="kids-add-profile-button"
              disabled={children.length >= 4}
              onClick={addChildProfile}
              type="button"
            >
              <Plus aria-hidden="true" size={18} />
              Add child
            </button>
            <button className="parent-gate-cancel" onClick={() => setShowProfileSettings(false)} type="button">
              Done
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ChildSelector({
  children,
  onSelect,
  onOpenSettings,
  selectedChildId
}: {
  children: ChildProfile[];
  onSelect: (childId: string) => void;
  onOpenSettings: () => void;
  selectedChildId: string;
}) {
  return (
    <div className="child-selector">
      <div className="child-selector-title">
        <p>Who is creating today?</p>
        <button aria-label="Edit kid names" onClick={onOpenSettings} type="button">
          <Settings aria-hidden="true" size={17} />
        </button>
      </div>
      <div>
        {children.map((child) => (
          <button
            className={selectedChildId === child.id ? "active" : ""}
            key={child.id}
            onClick={() => onSelect(child.id)}
            type="button"
          >
            <strong>{child.avatar}</strong>
            <span>{child.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountStatus({
  isAuthLoading,
  onLogout,
  userEmail
}: {
  isAuthLoading: boolean;
  onLogout: () => Promise<void>;
  userEmail: string | null;
}) {
  if (isAuthLoading) {
    return <p className="kids-account-note">Checking account...</p>;
  }

  if (!userEmail) {
    return (
      <div className="kids-account-box">
        <UserRound aria-hidden="true" size={20} />
        <span>Sign in from Parent Mode to connect this browser to a Cleanote account.</span>
        <a href="/login">Sign in</a>
      </div>
    );
  }

  return (
    <div className="kids-account-box">
      <Check aria-hidden="true" size={20} />
      <span>Signed in as {userEmail}. Drawings are visible in Parent Mode on this device.</span>
      <button onClick={() => void onLogout()} type="button">Sign out</button>
    </div>
  );
}

function DrawingCanvas({
  activity,
  guideLabel,
  onNext,
  onSave,
  shape,
  template
}: {
  activity: KidsActivity;
  guideLabel: string;
  onNext: () => void;
  onSave: (image: string) => void;
  shape: string;
  template: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<Tool>("pen");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const showTemplate = activity !== "draw";

  useEffect(() => {
    drawCanvas(canvasRef.current, strokes, showTemplate ? activity : "draw", template, shape);
  }, [activity, shape, showTemplate, strokes, template]);

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function beginStroke(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextStroke = { color, points: [getPoint(event)], size, tool };
    activeStrokeRef.current = nextStroke;
    setStrokes((current) => [...current, nextStroke]);
    setRedoStack([]);
  }

  function continueStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) {
      return;
    }
    const point = getPoint(event);
    activeStrokeRef.current.points.push(point);
    setStrokes((current) => {
      const next = current.slice();
      next[next.length - 1] = { ...activeStrokeRef.current!, points: [...activeStrokeRef.current!.points] };
      return next;
    });
  }

  function endStroke() {
    activeStrokeRef.current = null;
  }

  function clearCanvas() {
    setStrokes([]);
    setRedoStack([]);
  }

  function undo() {
    setStrokes((current) => {
      if (!current.length) {
        return current;
      }
      const next = current.slice(0, -1);
      setRedoStack((redo) => [current[current.length - 1], ...redo]);
      return next;
    });
  }

  function redo() {
    setRedoStack((current) => {
      if (!current.length) {
        return current;
      }
      const [first, ...rest] = current;
      setStrokes((existing) => [...existing, first]);
      return rest;
    });
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="drawing-studio">
      <div className="kids-canvas-wrap">
        <canvas
          aria-label={`${guideLabel} drawing canvas`}
          height={820}
          onPointerCancel={endStroke}
          onPointerDown={beginStroke}
          onPointerMove={continueStroke}
          onPointerUp={endStroke}
          ref={canvasRef}
          width={1120}
        />
      </div>

      <div className="kids-toolbars">
        <div className="kids-toolbar">
          <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")} type="button">
            <Brush aria-hidden="true" size={22} />
            Pen
          </button>
          <button
            className={tool === "eraser" ? "active" : ""}
            onClick={() => setTool("eraser")}
            type="button"
          >
            <Eraser aria-hidden="true" size={22} />
            Eraser
          </button>
          <button onClick={undo} type="button">
            <Undo2 aria-hidden="true" size={22} />
            Undo
          </button>
          <button onClick={redo} type="button">
            <Redo2 aria-hidden="true" size={22} />
            Redo
          </button>
          <button onClick={clearCanvas} type="button">
            <RotateCcw aria-hidden="true" size={22} />
            Clear
          </button>
          <button className="save-creation" onClick={save} type="button">
            <Save aria-hidden="true" size={22} />
            Save
          </button>
        </div>
        <div className="kids-toolbar secondary">
          {COLORS.map((nextColor) => (
            <button
              aria-label={`Use ${nextColor}`}
              className={color === nextColor ? "color active" : "color"}
              key={nextColor}
              onClick={() => {
                setColor(nextColor);
                setTool("pen");
              }}
              style={{ backgroundColor: nextColor }}
              type="button"
            />
          ))}
          {SIZES.map((nextSize) => (
            <button
              className={size === nextSize ? "size active" : "size"}
              key={nextSize}
              onClick={() => setSize(nextSize)}
              type="button"
            >
              {nextSize === 8 ? "Thin" : nextSize === 14 ? "Medium" : "Big"}
            </button>
          ))}
          {activity !== "draw" ? (
            <button className="next-practice" onClick={onNext} type="button">
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KidsGallery({ childName, creations }: { childName: string; creations: KidsCreation[] }) {
  const filteredCreations = useMemo(
    () => creations.filter((creation) => creation.childName === childName),
    [childName, creations]
  );

  return (
    <div className="kids-gallery">
      <div className="kids-workspace-header">
        <div>
          <p className="kids-kicker">Saved privately</p>
          <h2>{childName}&apos;s Art</h2>
        </div>
        <div className="celebration-pill">
          <Check aria-hidden="true" size={18} />
          Parent controlled
        </div>
      </div>
      {filteredCreations.length ? (
        <div className="kids-gallery-grid">
          {filteredCreations.map((creation) => (
            <article key={`${creation.createdAt}-${creation.title}`}>
              <img alt={creation.title} src={creation.image} />
              <h3>{creation.title}</h3>
              <p>{new Date(creation.createdAt).toLocaleDateString()}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="kids-empty-gallery">
          <Home aria-hidden="true" size={42} />
          <h3>No saved art yet</h3>
          <p>Draw or trace something, then tap Save.</p>
        </div>
      )}
    </div>
  );
}

function getActivityTitle(
  activity: KidsActivity,
  letterIndex: number,
  numberIndex: number,
  shapeIndex: number,
  childName: string
) {
  if (activity === "letters") {
    return `Trace Letter ${LETTERS[letterIndex]}`;
  }
  if (activity === "numbers") {
    return `Trace Number ${NUMBERS[numberIndex]}`;
  }
  if (activity === "shapes") {
    return `Trace a ${SHAPES[shapeIndex]}`;
  }
  if (activity === "name") {
    return `Trace ${childName}`;
  }
  return "Draw Anything";
}

function saveParentMemoryNote(creation: KidsCreation) {
  try {
    const existing = window.localStorage.getItem(SAVED_NOTES_KEY);
    const notes = existing ? JSON.parse(existing) : [];
    notes.unshift({
      contextText: "Digital creation saved from Cleanote Kids Mode.",
      createdAt: creation.createdAt,
      filename: `${creation.childName} - ${creation.title}`,
      id: `kids-${creation.createdAt}`,
      imageData: creation.image,
      provider: "kids-mode",
      subject: "kids",
      text: `${creation.title}\n\nSource: Kids Mode\nChild: ${creation.childName}\nSaved privately for parent review.`
    });
    window.localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(notes.slice(0, 60)));
  } catch {
    // If storage is unavailable, the child can keep drawing without interruption.
  }
}

function getAvatarLetter(name: string, fallback: string) {
  const trimmedName = name.trim();
  return trimmedName ? trimmedName[0].toUpperCase() : fallback;
}

function drawCanvas(
  canvas: HTMLCanvasElement | null,
  strokes: Stroke[],
  activity: KidsActivity,
  template: string,
  shape: string
) {
  if (!canvas) {
    return;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffdf6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawPaperLines(context, canvas.width, canvas.height);

  if (activity === "letters" || activity === "numbers" || activity === "name") {
    drawTemplateText(context, template, canvas.width, canvas.height);
  } else if (activity === "shapes") {
    drawTemplateShape(context, shape, canvas.width, canvas.height);
  }

  strokes.forEach((stroke) => drawStroke(context, stroke));
}

function drawPaperLines(context: CanvasRenderingContext2D, width: number, height: number) {
  context.strokeStyle = "rgba(111, 139, 170, 0.18)";
  context.lineWidth = 2;
  for (let y = 92; y < height; y += 92) {
    context.beginPath();
    context.moveTo(44, y);
    context.lineTo(width - 44, y);
    context.stroke();
  }
}

function drawTemplateText(context: CanvasRenderingContext2D, text: string, width: number, height: number) {
  context.save();
  context.font = text.length > 2 ? "190px Arial Rounded MT Bold, Arial, sans-serif" : "440px Arial Rounded MT Bold, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.setLineDash([18, 22]);
  context.lineWidth = 8;
  context.strokeStyle = "rgba(109, 93, 252, 0.32)";
  context.strokeText(text, width / 2, height / 2);
  context.setLineDash([]);
  context.fillStyle = "rgba(109, 93, 252, 0.06)";
  context.fillText(text, width / 2, height / 2);
  context.restore();
}

function drawTemplateShape(context: CanvasRenderingContext2D, shape: string, width: number, height: number) {
  context.save();
  context.setLineDash([18, 22]);
  context.lineWidth = 9;
  context.strokeStyle = "rgba(20, 168, 139, 0.35)";
  context.fillStyle = "rgba(20, 168, 139, 0.05)";
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.28;

  context.beginPath();
  if (shape === "Circle") {
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  } else if (shape === "Square") {
    context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  } else if (shape === "Rectangle") {
    context.rect(centerX - radius * 1.35, centerY - radius * 0.72, radius * 2.7, radius * 1.45);
  } else if (shape === "Triangle") {
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX - radius, centerY + radius);
    context.lineTo(centerX + radius, centerY + radius);
    context.closePath();
  } else if (shape === "Heart") {
    context.moveTo(centerX, centerY + radius * 0.75);
    context.bezierCurveTo(centerX - radius * 1.6, centerY - radius * 0.2, centerX - radius, centerY - radius * 1.1, centerX, centerY - radius * 0.35);
    context.bezierCurveTo(centerX + radius, centerY - radius * 1.1, centerX + radius * 1.6, centerY - radius * 0.2, centerX, centerY + radius * 0.75);
  } else {
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const pointRadius = index % 2 === 0 ? radius : radius * 0.45;
      const x = centerX + Math.cos(angle) * pointRadius;
      const y = centerY + Math.sin(angle) * pointRadius;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }
  context.fill();
  context.stroke();
  context.restore();
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) {
    return;
  }
  context.save();
  context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.size;
  context.strokeStyle = stroke.color;
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  if (stroke.points.length === 1) {
    context.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
    context.fillStyle = stroke.color;
    context.fill();
    context.restore();
    return;
  }
  stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
  context.restore();
}
