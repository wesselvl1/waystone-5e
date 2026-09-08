<template>
  <div class="min-h-screen pb-8">
    <!-- Header -->
    <header class="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-surface-900/95 backdrop-blur border-b border-surface-700/60">
      <NuxtLink to="/" class="btn-ghost p-2 -ml-2">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <h1 class="font-display text-lg font-semibold text-primary-400 tracking-wide">About</h1>
    </header>

    <main class="px-4 pt-6 max-w-lg mx-auto flex flex-col gap-6">
      <!-- App intro -->
      <div class="card flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <!-- Simple compass/stone icon -->
          <div class="w-12 h-12 rounded-xl bg-primary-600/20 border border-primary-600/40 flex items-center justify-center flex-shrink-0">
            <svg class="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8l2.5 5.5L12 16l-2.5-2.5L12 8z" />
            </svg>
          </div>
          <div>
            <h2 class="text-white font-semibold text-base font-display">Waystone</h2>
            <p class="text-slate-400 text-xs">D&amp;D 5e Character Manager</p>
          </div>
        </div>
        <p class="text-slate-300 text-sm leading-relaxed">
          An offline-first, mobile-friendly D&amp;D 5e character builder and digital character sheet.
          Runs entirely in the browser — no backend, no account required. All your characters and game
          data are stored locally on your device.
        </p>
      </div>

      <!-- Features -->
      <div class="card flex flex-col gap-3">
        <h3 class="text-slate-200 font-semibold text-sm uppercase tracking-wider">Features</h3>
        <ul class="flex flex-col gap-2 text-sm text-slate-300">
          <li class="flex items-start gap-2">
            <span class="text-primary-400 mt-0.5">✦</span>
            <span><span class="font-medium text-white">Character Creation</span> — guided 7-step wizard covering race, class, background, and ability scores</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary-400 mt-0.5">✦</span>
            <span><span class="font-medium text-white">Digital Character Sheet</span> — combat stats, spells, features, equipment, and notes</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary-400 mt-0.5">✦</span>
            <span><span class="font-medium text-white">Level Up Wizard</span> — HP, spell slots, ASIs, feats, and subclass selection</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary-400 mt-0.5">✦</span>
            <span><span class="font-medium text-white">Rulepacks</span> — pluggable JSON rule sets; SRD 5.1 ships built-in</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary-400 mt-0.5">✦</span>
            <span><span class="font-medium text-white">Fully Offline</span> — PWA with service worker caching; works without a network after first load</span>
          </li>
        </ul>
      </div>

      <!-- Links -->
      <div class="card flex flex-col gap-3">
        <h3 class="text-slate-200 font-semibold text-sm uppercase tracking-wider">Links</h3>
        <div class="flex flex-col gap-2">
          <!-- GitHub -->
          <a
            href="https://github.com/wesselvl1/waystone-5e"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-3 rounded-lg px-3 py-3 bg-surface-700/50 hover:bg-surface-700 transition-colors text-sm text-slate-200 hover:text-white"
          >
            <svg class="w-5 h-5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="font-medium leading-none">GitHub</p>
              <p class="text-slate-400 text-xs mt-0.5 truncate">wesselvl1/waystone-5e</p>
            </div>
            <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <!-- Ko-fi -->
          <a
            href="https://ko-fi.com/wesselvl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-3 rounded-lg px-3 py-3 bg-surface-700/50 hover:bg-surface-700 transition-colors text-sm text-slate-200 hover:text-white"
          >
            <svg class="w-5 h-5 flex-shrink-0 text-[#FF5E5B]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.23 11.496-.777c1.853-.308 1.853-1.539 1.853-1.539l.173-2.308s2.437.549 3.505-.318c1.012-.836 1.118-2.354.118-4.483 0 0 1.235.058 1.648-.811.383-.823.312-1.814-.52-3.063zm-16.726 3.28l-1.31 3.886H4.82l1.285-3.806H4.536l.387-1.153h3.43l-.358 1.073h-.04zm4.093.439l-.655 3.447h-1.011l.617-3.267h-1.013l.197-1.073h3.064l-.197 1.073h-.003l-.999-.18zm5.553 3.447h-1.01l.624-3.295h-.977l.197-1.065h2.987l-.197 1.065h-.944l-.68 3.295z"/>
            </svg>
            <div class="flex-1 min-w-0">
              <p class="font-medium leading-none">Support on Ko-fi</p>
              <p class="text-slate-400 text-xs mt-0.5 truncate">ko-fi.com/wesselvl</p>
            </div>
            <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <!-- Legal notice -->
      <p class="text-slate-500 text-xs text-center leading-relaxed px-2">
        Waystone uses content from the
        <a href="https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf" target="_blank" rel="noopener noreferrer" class="underline hover:text-slate-300 transition-colors">SRD 5.1</a>
        by Wizards of the Coast, available under the Open Game License v1.0a.
        Not affiliated with or endorsed by Wizards of the Coast.
      </p>
    </main>
  </div>
</template>
