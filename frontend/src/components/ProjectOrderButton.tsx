import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProjectOrderButtonProps = {
  source?: string;
  compact?: boolean;
};

type SubmitState = "idle" | "sending" | "success" | "error";

export default function ProjectOrderButton({ source = "site", compact = false }: ProjectOrderButtonProps) {
  const titleId = useId();
  const messageId = useId();
  const phoneId = useId();
  const emailId = useId();
  const fileId = useId();
  const commentId = useId();
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  function closeModal() {
    setOpen(false);
    openerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusables = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(selector) ?? []);
    focusables[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("sending");
    setMessage("");

    const formData = new FormData();
    formData.append("source", source);
    formData.append("phone", phone);
    formData.append("email", email);
    formData.append("comment", comment);
    if (file) formData.append("tz_file", file);

    try {
      const response = await fetch("/api/project-order", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Не удалось отправить заявку");
      }
      const payload = await response.json().catch(() => null);
      if (payload?.mail_sent === false) {
        throw new Error("Заявка сохранена, но письмо не отправлено. Проверьте настройки SMTP.");
      }
      setSubmitState("success");
      setMessage("Заявка отправлена. Мы свяжемся с вами по указанным контактам.");
      setPhone("");
      setEmail("");
      setComment("");
      setFile(null);
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку");
    }
  }

  const modal = open ? createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <div ref={modalRef} className="modal-card order-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-kicker">Проектирование</div>
            <h2 id={titleId}>Заказать проект КМ/КМД</h2>
          </div>
          <button className="modal-close" type="button" aria-label="Закрыть" onClick={closeModal}>
            ×
          </button>
        </div>

        <form className="order-form" onSubmit={submit}>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
          <div className="row2">
            <div className="field">
              <label htmlFor={phoneId}>Номер телефона</label>
              <input id={phoneId} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 ..." required />
            </div>
            <div className="field">
              <label htmlFor={emailId}>Почта</label>
              <input id={emailId} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="mail@example.ru" required />
            </div>
          </div>

          <div className="field">
            <label htmlFor={fileId}>Прикрепить ТЗ</label>
            <input
              id={fileId}
              type="file"
              accept=".doc,.docx,.pdf,.xls,.xlsx,.txt"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="field">
            <label htmlFor={commentId}>Комментарий</label>
            <textarea id={commentId} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Тип резервуара, объем, город, срочность, дополнительные требования" />
          </div>

          {message ? <div id={messageId} aria-live="polite" className={submitState === "success" ? "success-inline" : "warn-inline"}>{message}</div> : null}

          <div className="modal-actions">
            <button className="btn project-order-btn" type="submit" disabled={submitState === "sending"}>
              {submitState === "sending" ? "Отправка..." : "Отправить заявку"}
            </button>
            <button className="btn" type="button" onClick={closeModal}>
              Закрыть
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={openerRef} className={`btn project-order-btn${compact ? " compact" : ""}`} type="button" onClick={() => setOpen(true)}>
        Заказать проект КМ/КМД
      </button>
      {modal}
    </>
  );
}

