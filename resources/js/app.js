require('./bootstrap');

import Vue from 'vue';

import ScrollLink from './components/ScrollLink';
import DropDown from './components/DropDown';
import Visible from "./components/Visible";
import ConfirmButton from "./components/ConfirmButton";
import ConfirmDialog from "./components/ConfirmDialog";
import FlashMessage from "./components/FlashMessage";
import TriggerForm from "./components/TriggerForm";
import Calculator from "./components/Calculator";
import SidebarMenu from "./components/SidebarMenu";

import Modal from "./plugins/modal/ModalPlugin";

window.Vue = Vue;
window.Bus = new Vue();
Vue.use(Modal);

Vue.component('scroll-link', ScrollLink);
Vue.component('dropdown', DropDown);
Vue.component('visible', Visible);
Vue.component('confirm-dialog', ConfirmDialog);
Vue.component('confirm-button', ConfirmButton);
Vue.component('flash-message', FlashMessage);
Vue.component('trigger-form', TriggerForm);
Vue.component('calculator', Calculator);
Vue.component('sidebar-menu', SidebarMenu);


const app = new Vue({
    el: '#app',
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
    }
});
