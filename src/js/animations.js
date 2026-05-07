/**
 * VoteVault - Cool Animations & Interactions
 * Adds smooth animations, micro-interactions, and visual polish
 */

class UIAnimations {
  static init() {
    this.setupPageTransitions();
    this.setupButtonEffects();
    this.setupFormAnimations();
    this.setupTableAnimations();
  }

  /**
   * Smooth page transitions on load
   */
  static setupPageTransitions() {
    document.body.style.opacity = '0';
    window.addEventListener('load', () => {
      document.body.style.transition = 'opacity 0.4s ease-in';
      document.body.style.opacity = '1';
    });
  }

  /**
   * Add ripple effect to buttons on click
   */
  static setupButtonEffects() {
    document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        btn.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
      });
    });
  }

  /**
   * Stagger animation for form inputs
   */
  static setupFormAnimations() {
    document.querySelectorAll('input, textarea').forEach((input, index) => {
      input.addEventListener('focus', () => {
        input.style.transform = 'scale(1.02)';
      });
      
      input.addEventListener('blur', () => {
        input.style.transform = 'scale(1)';
      });
    });
  }

  /**
   * Fade in table rows with stagger
   */
  static setupTableAnimations() {
    document.querySelectorAll('tbody tr').forEach((row, index) => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        row.style.transition = 'all 0.5s ease-out';
        row.style.opacity = '1';
        row.style.transform = 'translateX(0)';
      }, index * 100);
    });
  }

  /**
   * Show success notification
   */
  static showSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
      z-index: 10000;
      animation: slideDown 0.4s ease-out;
      font-weight: 600;
      font-size: 0.95rem;
    `;
    notification.textContent = '✓ ' + message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Show error notification
   */
  static showError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
      z-index: 10000;
      animation: slideDown 0.4s ease-out;
      font-weight: 600;
      font-size: 0.95rem;
    `;
    notification.textContent = '✕ ' + message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  /**
   * Pulse animation for important elements
   */
  static pulse(element, duration = 500) {
    element.style.animation = `pulse ${duration}ms ease-in-out`;
    setTimeout(() => {
      element.style.animation = 'none';
    }, duration);
  }

  /**
   * Smooth scroll animation
   */
  static smoothScroll(target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Add ripple effect CSS
const style = document.createElement('style');
style.textContent = `
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    transform: scale(0);
    animation: ripple-animation 0.6s ease-out;
    pointer-events: none;
  }

  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  input:focus,
  textarea:focus {
    transition: transform 0.2s ease;
  }
`;
document.head.appendChild(style);

// Initialize animations when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UIAnimations.init());
} else {
  UIAnimations.init();
}
