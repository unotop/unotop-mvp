/**
 * PR-20: AboutAuthorModal - O autorovi + verzia aplikácie
 *
 * Zobrazuje bio Ing. Adam Belohorec (finančný maklér, zakladateľ UNOTOP).
 * Layout: 50/50 split (osobné info ľavo, firemné info vpravo).
 * Copyright © 2017–2025, fotka štvorcová (rounded-xl), verzia aplikácie.
 */

import React from "react";
import { APP_VERSION } from "../config/appVersion";

interface AboutAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutAuthorModal: React.FC<AboutAuthorModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-author-title"
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <h2
            id="about-author-title"
            className="text-2xl font-bold text-slate-100"
          >
            O autorovi
          </h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Zavrieť"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* 50/50 Layout: Osobné info ľavo, Firemné info vpravo */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Ľavá strana: Osobné info */}
            <div className="space-y-4">
              {/* Fotka - PR-17: štvorcová so zaoblenými rohmi (nie kruhová) */}
              <div className="flex justify-center md:justify-start">
                <div className="w-40 h-40 rounded-xl overflow-hidden border-2 border-blue-500/30">
                  <img
                    src="/Foto.jpeg"
                    alt="Ing. Adam Belohorec"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "50% 20%" }}
                    onError={(e) => {
                      // Fallback na iniciály ak fotka chýba
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.parentElement;
                      if (fallback) {
                        fallback.className =
                          "w-40 h-40 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white border-2 border-blue-500/30";
                        fallback.textContent = "AB";
                      }
                    }}
                  />
                </div>
              </div>

              {/* Meno a pozícia */}
              <div>
                <h3 className="text-xl font-semibold text-slate-100">
                  Ing. Adam Belohorec
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Finančný maklér • Zakladateľ UNOTOP
                </p>
              </div>

              {/* Kontaktné údaje */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-slate-500">📧</span>
                  <a
                    href="mailto:adam.belohorec@universal.sk"
                    className="hover:text-blue-400 transition-colors"
                  >
                    adam.belohorec@universal.sk
                  </a>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-slate-500">📞</span>
                  <span>+421 905 123 456</span>
                </div>
              </div>

              {/* Bio - PR-17: správa majetku, nie iba "finančná sloboda" */}
              <div className="text-sm text-slate-300 leading-relaxed pt-2">
                <p>
                  Vo financiách pôsobím od roku 2013 ako finančný maklér so
                  zameraním na osobné financie a investičné plánovanie. Pomáham
                  ľuďom získať prehľad vo všetkých zmluvách, znížiť zbytočné
                  náklady a nastaviť systém, ktorý im pomáha dlhodobo spravovať
                  a budovať majetok.
                </p>
              </div>
            </div>

            {/* Pravá strana: Firemné info */}
            <div className="space-y-4">
              {/* UNOTOP projekt - PR-19: majetkový plánovač */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                <h4 className="text-lg font-semibold text-slate-100 mb-2">
                  UNOTOP – majetkový plánovač
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  UNOTOP je môj vlastný projekt – inteligentný majetkový
                  plánovač, ktorý spája dlhoročnú prax finančného makléra s
                  jednoduchým vizuálnym nástrojom. Pomáha vám vidieť, kam
                  smerujú vaše financie pri rôznych scenároch a aký vplyv majú
                  vaše rozhodnutia na budúci majetok – bez nutnosti chodiť po
                  pobočkách bánk.
                </p>
              </div>

              {/* PR-19: Autor a vlastník aplikácie */}
              <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
                <h4 className="text-sm font-semibold text-slate-100 mb-2">
                  Autor a vlastník aplikácie
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Aplikáciu UNOTOP – majetkový plánovač a jej metodiku vytvoril
                  a vlastní Ing. Adam Belohorec. Koncept UNOTOP rozvíjam od roku
                  2017.
                </p>
              </div>

              {/* Firemné údaje */}
              <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
                <h4 className="text-sm font-semibold text-slate-100 mb-3">
                  Firemné údaje
                </h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500">Firma:</span>{" "}
                    <span className="font-medium">FINEXPERT GROUP a. s.</span>
                  </div>
                  <div>
                    <span className="text-slate-500">IČO:</span>{" "}
                    <span className="font-medium">56 965 001</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Sídlo:</span>{" "}
                    <span>
                      Južná trieda 2881/4B
                      <br />
                      Košice - mestská časť Juh 040 01
                    </span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-xs text-slate-500 leading-relaxed">
                <p>
                  Všetky výpočty a projekcie v UNOTOP sú len orientačné a
                  neslúžia ako investičné odporúčanie. Pred akýmkoľvek
                  investičným rozhodnutím konzultujte s odborníkom.
                </p>
              </div>
            </div>
          </div>

          {/* PR-20: Verzia aplikácie */}
          <div className="pt-4 mt-4 border-t border-white/5">
            <p className="text-xs text-slate-500 text-center">
              Verzia aplikácie: {APP_VERSION}
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-white/10">
            <a
              href="mailto:adam.belohorec@universal.sk"
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-center transition-colors"
            >
              📧 Kontaktovať
            </a>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
            >
              Zavrieť
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
