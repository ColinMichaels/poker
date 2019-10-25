require('./bootstrap');

import { InertiaApp } from '@inertiajs/inertia-vue'
import PortalVue from 'portal-vue'
import Vue from 'vue';
import VueMeta from 'vue-meta';

// import PokerChip from "./components/Poker/Chip";
// import PokerCard from "./components/Poker/Card";
// import ScrollLink from './components/shared/ScrollLink';
// import DropDown from './components/shared/DropDown';
// import Visible from "./components/shared/Visible";
// import ConfirmButton from "./components/shared/ConfirmButton";
// import ConfirmDialog from "./components/shared/ConfirmDialog";
// import FlashMessage from "./components/shared/FlashMessage";
// import TriggerForm from "./components/shared/TriggerForm";
// import Calculator from "./components/shared/Calculator";
// import SidebarMenu from "./components/shared/SidebarMenu";

// import Modal from "./plugins/modal/ModalPlugin";
// import Game from "./plugins/game/GamePlugin";

window.Vue = Vue;
window.Bus = new Vue();
Vue.mixin({ methods: { route: window.route } })
Vue.use(InertiaApp);
// Vue.use(Modal);
Vue.use(PortalVue);
Vue.use(VueMeta);

// Vue.use(Game);

// Vue.component('chip', PokerChip);
// Vue.component('card', PokerCard);
// Vue.component('scroll-link', ScrollLink);
// Vue.component('dropdown', DropDown);
// Vue.component('visible', Visible);
// Vue.component('confirm-dialog', ConfirmDialog);
// Vue.component('confirm-button', ConfirmButton);
// Vue.component('flash-message', FlashMessage);
// Vue.component('trigger-form', TriggerForm);
// Vue.component('calculator', Calculator);
// Vue.component('sidebar-menu', SidebarMenu);


let app = document.getElementById('app');

new Vue({
    metaInfo: {
        title : 'Loading..',
        titleTemplate: '%s | Poker'
    },
    // methods: {
    //     confirm(message) {
    //         this.$modal.dialog(message)
    //             .then(confirmed => {
    //                 if (confirmed) {
    //                     // Proceed. Submit ajax request, etc.
    //                     alert('Proceed');
    //                 } else {
    //                     // Optionally override the button visibility and labels.
    //                     this.$modal.dialog('Okay, canceled', {
    //                         cancelButton: 'Close',
    //                         confirmButton: false
    //                     });
    //                 }
    //             });
    //     }
    // },
    render: h => h(InertiaApp, {
        props: {
            initialPage: JSON.parse(app.dataset.page),
            resolveComponent: name => require(`./Pages/${name}`).default,
            //resolveComponent: name => import(`./Pages/${name}`).then(module => module.default),
        },
    }),
}).$mount(app)

