/**
 * ItcSlider by itchief v3.0.0 (https://github.com/itchief/ui-components/tree/master/itc-slider)
 * Copyright 2020 - 2022 Alexander Maltsev
 * Licensed under MIT (https://github.com/itchief/ui-components/blob/master/LICENSE)
 */

class ItcSlider {
  static CLASS_CONTROL = 'slider__control';
  static CLASS_CONTROL_HIDE = 'slider__control_hide';
  static CLASS_ITEM_ACTIVE = 'slider__item_active';
  static CLASS_INDICATOR_ACTIVE = 'active';
  static SEL_WRAPPER = '.slider__wrapper';
  static SEL_ITEM = '.slider__item';
  static SEL_ITEMS = '.slider__items';
  static SEL_PREV = '.slider__control[data-slide="prev"]';
  static SEL_NEXT = '.slider__control[data-slide="next"]';
  static SEL_INDICATOR = '.slider__indicators>li';
  static TRANSITION_OFF = 'slider_disable-transition';

  static contains = [];

  static createInstances() {
    document.querySelectorAll('[data-slider="itc-slider"]').forEach((el) => {
      if (this.contains.find((item) => item.el === el)) {
        return;
      }
      const dataset = el.dataset;
      const params = {};
      Object.keys(dataset).forEach((key) => {
        if (key === 'slider') {
          return;
        }
        let value = dataset[key];
        value = value === 'true' ? true : value;
        value = value === 'false' ? false : value;
        value = Number.isNaN(Number(value)) ? Number(value) : value;
        params[key] = value;
      });
      this.contains.push({ el, slider: new ItcSlider(el, params) });
      el.dataset.sliderId = this.contains.length;
      el.querySelectorAll('.slider__control').forEach((btn) => {
        btn.dataset.sliderTarget = this.contains.length;
      });
    });
  }

  constructor(selector, config) {
    this._el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    this._elWrapper = this._el.querySelector(ItcSlider.SEL_WRAPPER);
    this._elItems = this._el.querySelector(ItcSlider.SEL_ITEMS);
    this._elsItem = this._el.querySelectorAll(ItcSlider.SEL_ITEM);
    this._elBtnPrev = this._el.querySelector(ItcSlider.SEL_PREV);
    this._elBtnNext = this._el.querySelector(ItcSlider.SEL_NEXT);
    this._elsIndicator = this._el.querySelectorAll(ItcSlider.SEL_INDICATOR);

    this._exOrderMin = 0;
    this._exOrderMax = 0;
    this._exItemMin = null;
    this._exItemMax = null;
    this._exTranslateMin = 0;
    this._exTranslateMax = 0;

    this._direction = 'next';

    this._intervalId = null;

    this._isSwiping = false;
    this._swipeX = 0;

    this._config = {
      loop: true,
      autoplay: false,
      interval: 5000,
      refresh: true,
      swipe: true,
      ...config
    };

    this._setInitialValues();
    this._addEventListener();
  }

  _addEventListener() {
    this._el.addEventListener('click', (e) => {
      this._autoplay('stop');
      if (e.target.classList.contains(ItcSlider.CLASS_CONTROL)) {
        e.preventDefault();
        this._direction = e.target.dataset.slide;
        this._move();
      } else if (e.target.dataset.slideTo) {
        const index = parseInt(e.target.dataset.slideTo, 10);
        this._moveTo(index);
      }
      this._config.loop ? this._autoplay() : null;
    });
    this._el.addEventListener('mouseenter', () => {
      this._autoplay('stop');
    });
    this._el.addEventListener('mouseleave', () => {
      this._autoplay();
    });
    if (this._config.refresh) {
      window.addEventListener('resize', () => {
        window.requestAnimationFrame(this._reset.bind(this));
      });
    }
    if (this._config.loop) {
      this._elItems.addEventListener('transition-start', () => {
        if (this._isBalancing) {
          return;
        }
        this._isBalancing = true;
        window.requestAnimationFrame(this._balanceItems.bind(this));
      });
      this._elItems.addEventListener('transitionend', () => {
        this._isBalancing = false;
      });
    }
    const onSwipeStart = (e) => {
      this._autoplay('stop');
      const event = e.type.search('touch') === 0 ? e.touches[0] : e;
      this._swipeX = event.clientX;
      this._isSwiping = true;
    };
    const onSwipeEnd = (e) => {
      if (!this._isSwiping) {
        return;
      }
      const event = e.type.search('touch') === 0 ? e.changedTouches[0] : e;
      const diffPos = this._swipeX - event.clientX;
      if (diffPos > 50) {
        this._direction = 'next';
        this._move();
      } else if (diffPos < -50) {
        this._direction = 'prev';
        this._move();
      }
      this._isSwiping = false;
      if (this._config.loop) {
        this._autoplay();
      }
    };
    if (this._config.swipe) {
      this._el.addEventListener('touchstart', onSwipeStart);
      this._el.addEventListener('mousedown', onSwipeStart);
      document.addEventListener('touchend', onSwipeEnd);
      document.addEventListener('mouseup', onSwipeEnd);
    }
    this._el.addEventListener('dragstart', (e) => {
      e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this._autoplay('stop');
      } else if (document.visibilityState === 'visible' && this._config.loop) {
        this._autoplay();
      }
    });
  }
  _updateExProperties() {
    const els = Object.values(this._elsItem).map((el) => el);
    const orders = els.map((item) => Number(item.dataset.order));
    this._exOrderMin = Math.min(...orders);
    this._exOrderMax = Math.max(...orders);
    const min = orders.indexOf(this._exOrderMin);
    const max = orders.indexOf(this._exOrderMax);
    this._exItemMin = els[min];
    this._exItemMax = els[max];
    this._exTranslateMin = Number(this._exItemMin.dataset.translate);
    this._exTranslateMax = Number(this._exItemMax.dataset.translate);
  }
  _balanceItems() {
    if (!this._isBalancing) {
      return;
    }
    const $wrapperClientRect = this._elWrapper.getBoundingClientRect();
    const widthHalfItem = $wrapperClientRect.width / this._countActiveItems / 2;
    const count = this._elsItem.length;
    let translate;
    let clientRect;
    if (this._direction === 'next') {
      const wrapperLeft = $wrapperClientRect.left;
      const $min = this._exItemMin;
      translate = this._exTranslateMin;
      clientRect = $min.getBoundingClientRect();
      if (clientRect.right < wrapperLeft - widthHalfItem) {
        $min.dataset.order = this._exOrderMin + count;
        translate += count * this._widthItem;
        $min.dataset.translate = translate;
        $min.style.transform = `translateX(${translate}px)`;
        // update values of extreme properties
        this._updateExProperties();
      }
    } else {
      const wrapperRight = $wrapperClientRect.right;
      const $max = this._exItemMax;
      translate = this._exTranslateMax;
      clientRect = $max.getBoundingClientRect();
      if (clientRect.left > wrapperRight + widthHalfItem) {
        $max.dataset.order = this._exOrderMax - count;
        translate -= count * this._widthItem;
        $max.dataset.translate = translate;
        $max.style.transform = `translateX(${translate}px)`;
        // update values of extreme properties
        this._updateExProperties();
      }
    }
    // updating...
    requestAnimationFrame(this._balanceItems.bind(this));
  }
  _changeActiveItems() {
    this._stateItems.forEach((item, index) => {
      if (item) {
        this._elsItem[index].classList.add(ItcSlider.CLASS_ITEM_ACTIVE);
      } else {
        this._elsItem[index].classList.remove(ItcSlider.CLASS_ITEM_ACTIVE);
      }
      if (this._elsIndicator.length && item) {
        this._elsIndicator[index].classList.add(ItcSlider.CLASS_INDICATOR_ACTIVE);
      } else if (this._elsIndicator.length && !item) {
        this._elsIndicator[index].classList.remove(ItcSlider.CLASS_INDICATOR_ACTIVE);
      }
    });
  }
  _move() {
    const widthItem = this._direction === 'next' ? -this._widthItem : this._widthItem;
    const transform = this._transform + widthItem;
    if (!this._config.loop) {
      const endTransformValue = this._widthItem * (this._elsItem.length - this._countActiveItems);
      if (transform < -endTransformValue || transform > 0) {
        return;
      }
      if (this._elBtnPrev) {
        this._elBtnPrev.classList.remove(ItcSlider.CLASS_CONTROL_HIDE);
        this._elBtnNext.classList.remove(ItcSlider.CLASS_CONTROL_HIDE);
        if (transform === -endTransformValue) {
          this._elBtnNext.classList.add(ItcSlider.CLASS_CONTROL_HIDE);
        } else if (transform === 0) {
          this._elBtnPrev.classList.add(ItcSlider.CLASS_CONTROL_HIDE);
        }
      }
    }
    if (this._direction === 'next') {
      this._stateItems = [...this._stateItems.slice(-1), ...this._stateItems.slice(0, -1)];
    } else {
      this._stateItems = [...this._stateItems.slice(1), ...this._stateItems.slice(0, 1)];
    }
    this._changeActiveItems();
    this._transform = transform;
    this._elItems.style.transform = `translateX(${transform}px)`;
    this._elItems.dispatchEvent(new CustomEvent('transition-start', {
      bubbles: true,
    }));
  }
  _moveToNext() {
    this._direction = 'next';
    this._move();
  }
  _moveToPrev() {
    this._direction = 'prev';
    this._move();
  }
  _moveTo(index) {
    const delta = this._stateItems.reduce((acc, current, currentIndex) => {
      const diff = current ? index - currentIndex : acc;
      return Math.abs(diff) < Math.abs(acc) ? diff : acc;
    }, this._stateItems.length);
    if (delta !== 0) {
      this._direction = delta > 0 ? 'next' : 'prev';
      for (let i = 0; i < Math.abs(delta); i++) {
        this._move();
      }
    }
  }
  _autoplay(action) {
    if (!this._config.autoplay) {
      return;
    }
    if (action === 'stop') {
      clearInterval(this._intervalId);
      this._intervalId = null;
      return;
    }
    if (this._intervalId === null) {
      this._intervalId = setInterval(() => {
        this._direction = 'next';
        this._move();
      }, this._config.interval);
    }
  }
  _reset() {
    const widthItem = this._elsItem[0].getBoundingClientRect().width;
    const widthWrapper = this._elWrapper.getBoundingClientRect().width;
    const countActiveEls = Math.round(widthWrapper / widthItem);
    if (widthItem === this._widthItem && countActiveEls === this._countActiveItems) {
      return;
    }
    this._autoplay('stop');
    this._elItems.classList.add(ItcSlider.TRANSITION_OFF);
    this._elItems.style.transform = 'translateX(0)';
    this._setInitialValues();
    window.requestAnimationFrame(() => {
      this._elItems.classList.remove(ItcSlider.TRANSITION_OFF);
    });
  }
  _setInitialValues() {
    this._transform = 0;
    this._stateItems = [];
    this._isBalancing = false;
    this._widthItem = this._elsItem[0].getBoundingClientRect().width;
    this._widthWrapper = this._elWrapper.getBoundingClientRect().width;
    this._countActiveItems = Math.round(this._widthWrapper / this._widthItem);
    this._elsItem.forEach((el, index) => {
      el.dataset.index = index;
      el.dataset.order = index;
      el.dataset.translate = 0;
      el.style.transform = '';
      this._stateItems.push(index < this._countActiveItems ? 1 : 0);
    });
    if (this._config.loop) {
      const lastIndex = this._elsItem.length - 1;
      const translate = -(lastIndex + 1) * this._widthItem;
      this._elsItem[lastIndex].dataset.order = -1;
      this._elsItem[lastIndex].dataset.translate = translate;
      this._elsItem[lastIndex].style.transform = `translateX(${translate}px)`;
      this._updateExProperties();
    } else if (this._elBtnPrev) {
      this._elBtnPrev.classList.add(ItcSlider.CLASS_CONTROL_HIDE);
    }
    this._changeActiveItems();
    this._autoplay();
  }
  next() {
    this._moveToNext();
  }
  prev() {
    this._moveToPrev();
  }
  moveTo(index) {
    this._moveTo(index);
  }
  refresh() {
    this._reset();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ItcSlider.createInstances();
});
