const { ORDER_STATUS } = require('../../utils/constants');

Component({
  properties: {
    status: { type: String, value: 'placed' }
  },
  data: {
    statusMap: ORDER_STATUS
  }
});
