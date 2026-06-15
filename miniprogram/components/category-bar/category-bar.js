const { CATEGORIES } = require('../../utils/constants');

Component({
  properties: {
    activeKey: {
      type: String,
      value: 'breakfast'
    }
  },
  data: {
    categories: CATEGORIES
  },
  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key;
      if (key !== this.data.activeKey) {
        this.setData({ activeKey: key });
        this.triggerEvent('change', { key });
      }
    }
  }
});
