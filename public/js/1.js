(window.webpackJsonp=window.webpackJsonp||[]).push([[1],{"+SZM":function(t,e,s){"use strict";var r=s("Q7Qx"),a={data:function(){return{show:!0}},watch:{"$page.flash":{handler:function(){this.show=!0},deep:!0}}},n=s("KHd+"),i=Object(n.a)(a,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("div",[t.$page.flash.success&&t.show?s("div",{staticClass:"mb-8 flex items-center justify-between bg-green rounded max-w-lg"},[s("div",{staticClass:"flex items-center"},[s("svg",{staticClass:"ml-4 mr-2 flex-no-shrink w-4 h-4 fill-white",attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("polygon",{attrs:{points:"0 11 2 9 7 14 18 3 20 5 7 18"}})]),t._v(" "),s("div",{staticClass:"py-4 text-white text-sm font-medium"},[t._v(t._s(t.$page.flash.success))])]),t._v(" "),s("button",{staticClass:"group mr-2 p-2",attrs:{type:"button"},on:{click:function(e){t.show=!1}}},[s("svg",{staticClass:"block w-2 h-2 fill-green-dark group-hover:fill-green-darker",attrs:{xmlns:"http://www.w3.org/2000/svg",width:"235.908",height:"235.908",viewBox:"278.046 126.846 235.908 235.908"}},[s("path",{attrs:{d:"M506.784 134.017c-9.56-9.56-25.06-9.56-34.62 0L396 210.18l-76.164-76.164c-9.56-9.56-25.06-9.56-34.62 0-9.56 9.56-9.56 25.06 0 34.62L361.38 244.8l-76.164 76.165c-9.56 9.56-9.56 25.06 0 34.62 9.56 9.56 25.06 9.56 34.62 0L396 279.42l76.164 76.165c9.56 9.56 25.06 9.56 34.62 0 9.56-9.56 9.56-25.06 0-34.62L430.62 244.8l76.164-76.163c9.56-9.56 9.56-25.06 0-34.62z"}})])])]):t._e(),t._v(" "),Object.keys(t.$page.errors).length>0&&t.show?s("div",{staticClass:"mb-8 flex items-center justify-between bg-red-light rounded max-w-lg"},[s("div",{staticClass:"flex items-center"},[s("svg",{staticClass:"ml-4 mr-2 flex-no-shrink w-4 h-4 fill-white",attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm1.41-1.41A8 8 0 1 0 15.66 4.34 8 8 0 0 0 4.34 15.66zm9.9-8.49L11.41 10l2.83 2.83-1.41 1.41L10 11.41l-2.83 2.83-1.41-1.41L8.59 10 5.76 7.17l1.41-1.41L10 8.59l2.83-2.83 1.41 1.41z"}})]),t._v(" "),s("div",{staticClass:"py-4 text-white text-sm font-medium"},[1===Object.keys(t.$page.errors).length?s("span",[t._v("There is one form error.")]):s("span",[t._v("There are "+t._s(Object.keys(t.$page.errors).length)+" form errors.")])])]),t._v(" "),s("button",{staticClass:"group mr-2 p-2",attrs:{type:"button"},on:{click:function(e){t.show=!1}}},[s("svg",{staticClass:"block w-2 h-2 fill-red-dark group-hover:fill-red-darker",attrs:{xmlns:"http://www.w3.org/2000/svg",width:"235.908",height:"235.908",viewBox:"278.046 126.846 235.908 235.908"}},[s("path",{attrs:{d:"M506.784 134.017c-9.56-9.56-25.06-9.56-34.62 0L396 210.18l-76.164-76.164c-9.56-9.56-25.06-9.56-34.62 0-9.56 9.56-9.56 25.06 0 34.62L361.38 244.8l-76.164 76.165c-9.56 9.56-9.56 25.06 0 34.62 9.56 9.56 25.06 9.56 34.62 0L396 279.42l76.164 76.165c9.56 9.56 25.06 9.56 34.62 0 9.56-9.56 9.56-25.06 0-34.62L430.62 244.8l76.164-76.163c9.56-9.56 9.56-25.06 0-34.62z"}})])])]):t._e()])}),[],!1,null,null,null).exports,l=s("MY0P"),o=s("lrC8"),c={components:{Icon:l.a},props:{url:String},methods:{isUrl:function(){for(var t=this,e=arguments.length,s=new Array(e),r=0;r<e;r++)s[r]=arguments[r];return""===s[0]?""===this.url:s.filter((function(e){return t.url.startsWith(e)})).length}}},u=Object(n.a)(c,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("div",[s("div",{staticClass:"mb-4 text-gray-900 p-4 sm:text-white bg-white sm:bg-gray-900 sm:p-0 text-2xl"},[s("inertia-link",{staticClass:"flex items-center group py-5",attrs:{href:t.route("home")}},[s("div",{class:t.isUrl("home")?"text-white":"text-gray-700 group-hover:text-white"},[s("i",{staticClass:"fa fa-home"}),t._v(" Start")])]),t._v(" "),s("inertia-link",{staticClass:"flex items-center group py-5",attrs:{href:t.route("hands.index")}},[s("div",{class:t.isUrl("hands")?"text-white  hover:text-gray-700":"text-gray-700 hover:text-white"},[s("i",{staticClass:"fa fa-gamepad"}),t._v(" Hands")])]),t._v(" "),s("inertia-link",{staticClass:"flex items-center group py-5",attrs:{href:t.route("howto.index")}},[s("div",{class:t.isUrl("howto")?"text-white  hover:text-gray-700":"text-gray-700 hover:text-white"},[s("i",{staticClass:"fa fa-question-circle"}),t._v(" How to")])]),t._v(" "),s("inertia-link",{staticClass:"flex items-center group py-5",attrs:{href:t.route("spotify.index")}},[s("div",{class:t.isUrl("spotify")?"text-green-500  hover:text-green-800":"text-gray-700 hover:text-green-800"},[s("i",{staticClass:"fab fa-spotify"}),t._v(" Spotify")])])],1)])}),[],!1,null,null,null).exports,h={components:{Dropdown:r.a,FlashMessages:i,Icon:l.a,Logo:o.a,MainMenu:u},data:function(){return{showUserMenu:!1,accounts:null}},computed:{},methods:{url:function(){return location.pathname.substr(1)},hideDropdownMenus:function(){this.showUserMenu=!1}}},v=Object(n.a)(h,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("div",[s("portal-target",{attrs:{name:"dropdown",slim:""}}),t._v(" "),s("div",{staticClass:"flex flex-col bg-gray-1000"},[s("div",{staticClass:"h-screen flex flex-col select-none focus:outline-none focus:shadow-none",on:{click:t.hideDropdownMenus}},[s("div",{staticClass:"md:flex"},[s("div",{staticClass:"bg-white md:flex-no-shrink md:w-56 px-6 py-2 flex items-center justify-between md:justify-center"},[s("inertia-link",{staticClass:"mx-auto text-center pl-2",attrs:{href:"/"}},[s("logo",{staticClass:"fill-white"})],1),t._v(" "),s("dropdown",{staticClass:"md:hidden",attrs:{placement:"bottom-end"}},[s("svg",{staticClass:"fill-white w-6 h-6",attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"}})]),t._v(" "),s("div",{staticClass:"mt-2 px-8 py-4 shadow-lg bg-indigo-darker rounded",attrs:{slot:"dropdown"},slot:"dropdown"},[s("main-menu",{attrs:{url:t.url()}})],1)])],1),t._v(" "),s("div",{staticClass:"bg-white w-full p-4 md:py-0 md:px-12 text-sm md:text-base flex justify-between items-center"},[s("div",{staticClass:"mt-1 mr-4"},[t._v(t._s(t.$page.auth.user.first_name))]),t._v(" "),s("div",{staticClass:"player-stats"},[s("div",{staticClass:"stats py-2 px-4 bg-gray-800 text-white rounded shadow font-extrabold"},[s("span",{staticClass:"text-gray-500"},[t._v("WALLET:")]),t._v(" $"+t._s(t.$page.auth.user.player.wallet)+"\n                               "),s("span",{staticClass:"text-gray-500"},[t._v(" WINS:")]),t._v(" "+t._s(t.$page.auth.user.player.wins)+"\n                        ")])]),t._v(" "),s("dropdown",{staticClass:"mt-1",attrs:{placement:"bottom-end"}},[s("div",{staticClass:"flex items-center cursor-pointer select-none group"},[s("div",{staticClass:"text-grey-1000 group-hover:text-red-800 focus:text-red-900 mr-1 whitespace-no-wrap"},[s("span",[t._v(t._s(t.$page.auth.user.first_name))]),t._v(" "),s("span",{staticClass:"hidden md:inline"},[t._v(t._s(t.$page.auth.user.last_name))])]),t._v(" "),s("icon",{staticClass:"w-5 h-5 group-hover:fill-indigo-dark fill-grey-darkest focus:fill-indigo-dark",attrs:{name:"cheveron-down"}})],1),t._v(" "),s("div",{staticClass:"mt-2 py-2 shadow-lg bg-white rounded text-sm",attrs:{slot:"dropdown"},slot:"dropdown"},[s("inertia-link",{staticClass:"block px-6 py-2 hover:bg-gray-800 hover:text-white",attrs:{href:t.route("users.edit",t.$page.auth.user.id)}},[t._v("My Profile")]),t._v(" "),s("inertia-link",{staticClass:"block px-6 py-2 hover:bg-gray-800 hover:text-white",attrs:{href:"/users"}},[t._v("Manage Users")]),t._v(" "),s("inertia-link",{staticClass:"block px-6 py-2 hover:bg-gray-800 hover:text-white",attrs:{href:"/logout",method:"post"}},[t._v("Logout")])],1)])],1)]),t._v(" "),s("div",{staticClass:"flex flex-grow overflow-hidden"},[s("main-menu",{staticClass:"bg-gray-900 flex-no-shrink w-56 p-12 hidden md:block overflow-y-auto",attrs:{url:t.url()}}),t._v(" "),s("div",{staticClass:"w-full overflow-hidden px-4 py-8 md:p-12 overflow-y-auto",attrs:{"scroll-region":""}},[s("flash-messages"),t._v(" "),t._t("default")],2)],1)])])],1)}),[],!1,null,null,null);e.a=v.exports},MY0P:function(t,e,s){"use strict";var r={props:{name:String}},a=s("KHd+"),n=Object(a.a)(r,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return"apple"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",width:"100",height:"100",viewBox:"0 0 100 100"}},[s("g",{attrs:{"fill-rule":"nonzero"}},[s("path",{attrs:{d:"M46.173 19.967C49.927-1.838 19.797-.233 14.538.21c-.429.035-.648.4-.483.8 2.004 4.825 14.168 31.66 32.118 18.957zm13.18 1.636c1.269-.891 1.35-1.614.047-2.453l-2.657-1.71c-.94-.607-1.685-.606-2.532.129-5.094 4.42-7.336 9.18-8.211 15.24 1.597.682 3.55.79 5.265.328 1.298-4.283 3.64-8.412 8.088-11.534z"}}),s("path",{attrs:{d:"M88.588 67.75c9.65-27.532-13.697-45.537-35.453-32.322-1.84 1.118-4.601 1.118-6.441 0-21.757-13.215-45.105 4.79-35.454 32.321 5.302 15.123 17.06 39.95 37.295 29.995.772-.38 1.986-.38 2.758 0 20.235 9.955 31.991-14.872 37.295-29.995z"}})])]):"book"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M6 4H5a1 1 0 1 1 0-2h11V1a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-7v8l-2-2-2 2V4z"}})]):"cheveron-down"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"}})]):"cheveron-right"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("polygon",{attrs:{points:"12.95 10.707 13.657 10 8 4.343 6.586 5.757 10.828 10 6.586 14.243 8 15.657 12.95 10.707"}})]):"dashboard"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M10 20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm-5.6-4.29a9.95 9.95 0 0 1 11.2 0 8 8 0 1 0-11.2 0zm6.12-7.64l3.02-3.02 1.41 1.41-3.02 3.02a2 2 0 1 1-1.41-1.41z"}})]):"location"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M10 20S3 10.87 3 7a7 7 0 1 1 14 0c0 3.87-7 13-7 13zm0-11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"}})]):"office"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",width:"100",height:"100",viewBox:"0 0 100 100"}},[s("path",{attrs:{"fill-rule":"evenodd",d:"M7 0h86v100H57.108V88.418H42.892V100H7V0zm9 64h11v15H16V64zm57 0h11v15H73V64zm-19 0h11v15H54V64zm-19 0h11v15H35V64zM16 37h11v15H16V37zm57 0h11v15H73V37zm-19 0h11v15H54V37zm-19 0h11v15H35V37zM16 11h11v15H16V11zm57 0h11v15H73V11zm-19 0h11v15H54V11zm-19 0h11v15H35V11z"}})]):"printer"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M4 16H0V6h20v10h-4v4H4v-4zm2-4v6h8v-6H6zM4 0h12v5H4V0zM2 8v2h2V8H2zm4 0v2h2V8H6z"}})]):"shopping-cart"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M4 2h16l-3 9H4a1 1 0 1 0 0 2h13v2H4a3 3 0 0 1 0-6h.33L3 5 2 2H0V0h3a1 1 0 0 1 1 1v1zm1 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm10 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"}})]):"store-front"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M18 9.87V20H2V9.87a4.25 4.25 0 0 0 3-.38V14h10V9.5a4.26 4.26 0 0 0 3 .37zM3 0h4l-.67 6.03A3.43 3.43 0 0 1 3 9C1.34 9 .42 7.73.95 6.15L3 0zm5 0h4l.7 6.3c.17 1.5-.91 2.7-2.42 2.7h-.56A2.38 2.38 0 0 1 7.3 6.3L8 0zm5 0h4l2.05 6.15C19.58 7.73 18.65 9 17 9a3.42 3.42 0 0 1-3.33-2.97L13 0z"}})]):"trash"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M6 2l2-2h4l2 2h4v2H2V2h4zM3 6h14l-1 14H4L3 6zm5 2v10h1V8H8zm3 0v10h1V8h-1z"}})]):"users"===t.name?s("svg",{attrs:{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20"}},[s("path",{attrs:{d:"M7 8a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0 1c2.15 0 4.2.4 6.1 1.09L12 16h-1.25L10 20H4l-.75-4H2L.9 10.09A17.93 17.93 0 0 1 7 9zm8.31.17c1.32.18 2.59.48 3.8.92L18 16h-1.25L16 20h-3.96l.37-2h1.25l1.65-8.83zM13 0a4 4 0 1 1-1.33 7.76 5.96 5.96 0 0 0 0-7.52C12.1.1 12.53 0 13 0z"}})]):t._e()}),[],!1,null,null,null);e.a=n.exports},Q7Qx:function(t,e,s){"use strict";var r=s("8L3F"),a={props:{placement:{type:String,default:"bottom-end"},boundary:{type:String,default:"scrollParent"}},data:function(){return{show:!1}},watch:{show:function(t){var e=this;t?this.$nextTick((function(){e.popper=new r.a(e.$el,e.$refs.dropdown,{placement:e.placement,modifiers:{preventOverflow:{boundariesElement:e.boundary}}})})):this.popper&&setTimeout((function(){return e.popper.destroy()}),100)}},mounted:function(){var t=this;document.addEventListener("keydown",(function(e){27===e.keyCode&&t.close()}))},methods:{close:function(){this.show=!1},toggle:function(){this.show=!this.show}}},n=s("KHd+"),i=Object(n.a)(a,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("button",{attrs:{type:"button"},on:{click:t.toggle}},[t._t("default"),t._v(" "),t.show?s("portal",{attrs:{to:"dropdown"}},[s("div",[s("div",{staticStyle:{position:"fixed",top:"0",right:"0",left:"0",bottom:"0","z-index":"99998",background:"black",opacity:".2"},on:{click:t.toggle}}),t._v(" "),s("div",{ref:"dropdown",staticStyle:{position:"absolute","z-index":"99999"},on:{click:function(t){t.stopPropagation()}}},[t._t("dropdown")],2)])]):t._e()],2)}),[],!1,null,null,null);e.a=i.exports},SdmG:function(t,e,s){"use strict";var r={props:{value:File,label:String,accept:String,errors:{type:Array,default:function(){return[]}}},watch:{value:function(t){t||(this.$refs.file.value="")}},methods:{filesize:function(t){var e=Math.floor(Math.log(t)/Math.log(1024));return 1*(t/Math.pow(1024,e)).toFixed(2)+" "+["B","kB","MB","GB","TB"][e]},browse:function(){this.$refs.file.click()},change:function(t){this.$emit("input",t.target.files[0])},remove:function(){this.$emit("input",null)}}},a=s("KHd+"),n=Object(a.a)(r,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("div",[t.label?s("label",{staticClass:"form-label"},[t._v(t._s(t.label)+":")]):t._e(),t._v(" "),s("div",{staticClass:"form-input p-0",class:{error:t.errors.length}},[s("input",{ref:"file",staticClass:"hidden",attrs:{type:"file",accept:t.accept},on:{change:t.change}}),t._v(" "),t.value?s("div",{staticClass:"flex items-center justify-between p-2"},[s("div",{staticClass:"flex-1 pr-1"},[t._v(t._s(t.value.name)+" "),s("span",{staticClass:"text-grey-dark text-xs"},[t._v("("+t._s(t.filesize(t.value.size))+")")])]),t._v(" "),s("button",{staticClass:"px-4 py-1 bg-grey-dark hover:bg-grey-darker rounded-sm text-xs font-medium text-white",attrs:{type:"button"},on:{click:t.remove}},[t._v("\n        Remove\n      ")])]):s("div",{staticClass:"p-2"},[s("button",{staticClass:"px-4 py-1 bg-grey-dark hover:bg-grey-darker rounded-sm text-xs font-medium text-white",attrs:{type:"button"},on:{click:t.browse}},[t._v("\n        Browse\n      ")])])]),t._v(" "),t.errors.length?s("div",{staticClass:"form-error"},[t._v(t._s(t.errors[0]))]):t._e()])}),[],!1,null,null,null);e.a=n.exports},Ujtf:function(t,e,s){"use strict";var r={inheritAttrs:!1,props:{id:{type:String,default:function(){return"select-input-".concat(this._uid)}},value:[String,Number,Boolean],label:String,errors:{type:Array,default:function(){return[]}}},data:function(){return{selected:this.value}},watch:{selected:function(t){this.$emit("input",t)}},methods:{focus:function(){this.$refs.input.focus()},select:function(){this.$refs.input.select()}}},a=s("KHd+"),n=Object(a.a)(r,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("div",[t.label?s("label",{staticClass:"form-label",attrs:{for:t.id}},[t._v(t._s(t.label)+":")]):t._e(),t._v(" "),s("select",t._b({directives:[{name:"model",rawName:"v-model",value:t.selected,expression:"selected"}],ref:"input",staticClass:"form-select",class:{error:t.errors.length},attrs:{id:t.id},on:{change:function(e){var s=Array.prototype.filter.call(e.target.options,(function(t){return t.selected})).map((function(t){return"_value"in t?t._value:t.value}));t.selected=e.target.multiple?s:s[0]}}},"select",t.$attrs,!1),[t._t("default")],2),t._v(" "),t.errors.length?s("div",{staticClass:"form-error"},[t._v(t._s(t.errors[0]))]):t._e()])}),[],!1,null,null,null);e.a=n.exports},Z84v:function(t,e,s){"use strict";var r={props:{loading:Boolean}},a=s("KHd+"),n=Object(a.a)(r,(function(){var t=this.$createElement,e=this._self._c||t;return e("button",{staticClass:"flex items-center",attrs:{disabled:this.loading}},[this.loading?e("div",{staticClass:"btn-spinner mr-2"}):this._e(),this._v(" "),this._t("default")],2)}),[],!1,null,null,null);e.a=n.exports},lrC8:function(t,e,s){"use strict";var r=s("KHd+"),a=Object(r.a)({},(function(){var t=this.$createElement;this._self._c;return this._m(0)}),[function(){var t=this.$createElement,e=this._self._c||t;return e("div",[e("img",{staticClass:"w-full h-full",attrs:{src:"/Poker/logos/poker_logo_main.svg",alt:"logo"}})])}],!1,null,null,null);e.a=a.exports},"pF+r":function(t,e,s){"use strict";var r={inheritAttrs:!1,props:{id:{type:String,default:function(){return"text-input-".concat(this._uid)}},type:{type:String,default:"text"},value:String,label:String,errors:{type:Array,default:function(){return[]}}},methods:{focus:function(){this.$refs.input.focus()},select:function(){this.$refs.input.select()},setSelectionRange:function(t,e){this.$refs.input.setSelectionRange(t,e)}}},a=s("KHd+"),n=Object(a.a)(r,(function(){var t=this,e=t.$createElement,s=t._self._c||e;return s("div",{staticClass:"flex justify-between"},[t.label?s("label",{staticClass:"form-label self-center mr-2 font-black text-gray-700",attrs:{for:t.id}},[t._v(t._s(t.label)+":")]):t._e(),t._v(" "),s("input",t._b({ref:"input",staticClass:"form-input p-2 bg-gray-300 w-3/4",class:{error:t.errors.length},attrs:{id:t.id,type:t.type},domProps:{value:t.value},on:{input:function(e){return t.$emit("input",e.target.value)}}},"input",t.$attrs,!1)),t._v(" "),t.errors.length?s("div",{staticClass:"form-error"},[t._v(t._s(t.errors[0]))]):t._e()])}),[],!1,null,null,null);e.a=n.exports}}]);
//# sourceMappingURL=1.js.map?id=170aef70d1093489f7bb