 require('./bootstrap');
import Vue from 'vue';

import VueMeta from 'vue-meta';
import { InertiaApp } from '@inertiajs/inertia-vue'
import PortalVue from 'portal-vue'

 import Audio from "./plugins/audio/AudioPlugin";
import Modal from "./plugins/modal/ModalPlugin";
import Game from "./plugins/game/GamePlugin";

window.Vue = Vue;
window.Bus = new Vue();
Vue.config.productionTip = false
Vue.mixin({ methods: { route: window.route } });
Vue.use(InertiaApp);
Vue.use(Audio);
Vue.use(Modal);
Vue.use(PortalVue);
Vue.use(VueMeta);
Vue.use(Game);

let app = document.getElementById('app');

new Vue({
    metaInfo: {
        title : 'Loading..',
        titleTemplate: '%s | Poker'
    },
    methods: {
        confirm(message) {
            this.$modal.dialog(message)
                .then(confirmed => {
                    if (confirmed) {
                        // Proceed. Submit ajax request, etc.
                        alert('Proceed');
                    } else {
                        // Optionally override the button visibility and labels.
                        this.$modal.dialog('Okay, canceled', {
                            cancelButton: 'Close',
                            confirmButton: false
                        });
                    }
                });
        }
    },
    render: h => h(InertiaApp, {
        props: {
            initialPage: JSON.parse(app.dataset.page),
            resolveComponent: name => import(`@/Pages/${name}`).then(module => module.default),
        },
    }),
}).$mount(app);

