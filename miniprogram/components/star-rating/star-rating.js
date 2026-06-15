Component({
  properties: {
    rating: { type: Number, value: 0 },
    readOnly: { type: Boolean, value: false }
  },
  data: {
    stars: [1, 2, 3, 4, 5]
  },
  methods: {
    onTap(e) {
      if (this.data.readOnly) return;
      const value = e.currentTarget.dataset.value;
      this.setData({ rating: value });
      this.triggerEvent('rate', { rating: value });
    }
  }
});
