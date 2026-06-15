Component({
  properties: {
    dish: { type: Object, value: {} },
    quantity: { type: Number, value: 0 },
    showStepper: { type: Boolean, value: true },
    disabled: { type: Boolean, value: false }
  },
  methods: {
    onPlus() {
      if (this.data.disabled) return;
      this.triggerEvent('change', {
        dish: this.data.dish,
        quantity: this.data.quantity + 1
      });
    },
    onMinus() {
      if (this.data.disabled || this.data.quantity <= 0) return;
      this.triggerEvent('change', {
        dish: this.data.dish,
        quantity: Math.max(0, this.data.quantity - 1)
      });
    }
  }
});
