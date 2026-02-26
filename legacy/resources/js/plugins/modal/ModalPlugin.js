import ModalComponent from './ModalComponent';

let ModalPlugin = {
    install: function (Vue, options = {}) {
        Vue.component(options.name || 'modal', ModalComponent);

        ModalPlugin.events = new Vue();

        Vue.prototype.$modal = {
            show(name, params = {}) {
                location.hash = name;
                ModalPlugin.events.$emit('show', params);  // message, cancel-button, confirm-button
            },

            hide(name) {
                location.hash = '#';
            },

            dialog(message, params = {}) {
                if (typeof message === 'string') {
                    params.message = message;
                } else {
                    params = message;
                }

                return new Promise((resolve, reject) => {
                    this.show('dialog', params);

                    ModalPlugin.events.$on(
                        'clicked', confirmed => resolve(confirmed)
                    );
                });
            }
        }
    }
};

export default ModalPlugin;
