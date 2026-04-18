// frontend/js/components/modal/PickFavoriteStep.js
//
// Step 3 of the completion modal: show 3 candidate questions and let the
// player favorite one. Next is always enabled — clicking it without a pick
// just advances (soft skip). Once picked, the choice is final and that
// question never reappears for this voter.

import pickService from '../../services/PickService.js';
import eventService from '../../services/EventService.js';

class PickFavoriteStep {
  constructor(stepId) {
    this.stepElement = document.getElementById(stepId);
    this.listElement = this.stepElement.querySelector('.pick-list');
    this.nextButton = this.stepElement.querySelector('.btn-next');
    this.candidates = [];
    this.pickedId = null;
    this.submitted = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.nextButton) {
      this.nextButton.addEventListener('click', async () => {
        await this.handleNext();
      });
    }
  }

  async show() {
    this.stepElement.style.display = 'block';
    this.pickedId = null;
    this.submitted = false;
    this.listElement.innerHTML = '<div class="pick-loading text-center">Loading…</div>';

    const candidates = await pickService.fetchCandidates(3);

    // Null = error fetching; empty = voter has picked everything there is
    // to pick. In both cases, soft-skip the step so the flow keeps moving.
    if (!candidates || candidates.length === 0) {
      console.log('PickFavoriteStep: no candidates available, skipping');
      this.advanceToShare();
      return;
    }

    this.candidates = candidates;
    this.renderCandidates();
  }

  hide() {
    this.stepElement.style.display = 'none';
  }

  renderCandidates() {
    this.listElement.innerHTML = '';
    this.candidates.forEach((candidate, idx) => {
      const card = document.createElement('div');
      card.className = 'pick-card';
      card.dataset.questionId = candidate.id;
      card.innerHTML = `
        <div class="pick-badge">
          <span class="pick-badge-num">${idx + 1}</span>
          <i class="fas fa-check pick-badge-check"></i>
        </div>
        <div class="pick-text">${this.escapeHtml(candidate.question_text)}</div>
      `;
      card.addEventListener('click', () => this.handleCardClick(candidate.id));
      this.listElement.appendChild(card);
    });
  }

  handleCardClick(questionId) {
    if (this.submitted) return; // Lock after submission
    this.pickedId = this.pickedId === questionId ? null : questionId;
    this.updateCardStates();
  }

  updateCardStates() {
    this.listElement.querySelectorAll('.pick-card').forEach(card => {
      const id = card.dataset.questionId;
      card.classList.toggle('selected', this.pickedId === id);
      card.classList.toggle('dimmed', this.pickedId !== null && this.pickedId !== id);
    });
  }

  async handleNext() {
    if (this.submitted) {
      this.advanceToShare();
      return;
    }

    // Soft skip — no pick → just advance.
    if (this.pickedId === null) {
      this.advanceToShare();
      return;
    }

    // Submit then advance. Don't block on the response — if it fails we still
    // advance (the user's intent was to move on).
    this.submitted = true;
    this.nextButton.disabled = true;
    try {
      await pickService.submitPick(this.pickedId);
    } catch (err) {
      console.error('PickFavoriteStep: submit failed (proceeding anyway):', err);
    }
    this.nextButton.disabled = false;
    this.advanceToShare();
  }

  advanceToShare() {
    eventService.emit('modal:next-step', {
      currentStep: 'pick',
      nextStep: 'share'
    });
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export default PickFavoriteStep;
