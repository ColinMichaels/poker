<template>
    <div>
        <portal-target name="dropdown" slim />
        <div class="flex flex-col bg-gray-1000">
            <div class="h-screen flex flex-col select-none focus:outline-none focus:shadow-none" @click="hideDropdownMenus">
                <div class="md:flex">
                    <div class="bg-white md:flex-no-shrink md:w-56 px-6 py-2 flex items-center justify-between md:justify-center">
                        <inertia-link class="mx-auto text-center pl-2" href="/">
                            <logo class="fill-white" />
                        </inertia-link>
                        <dropdown class="md:hidden" placement="bottom-end">
                            <svg class="fill-white w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" /></svg>
                            <div slot="dropdown" class="mt-2 px-8 py-4 shadow-lg bg-indigo-darker rounded">
                                <main-menu :url="url()" />
                            </div>
                        </dropdown>
                    </div>
                    <div class="bg-white w-full p-4 md:py-0 md:px-12 text-sm md:text-base flex justify-between items-center">
                        <div class="mt-1 mr-4">{{ $page.auth.user.first_name }}</div>
                        <div class="player-stats">
                            <div class="stats py-2 px-4 bg-gray-800 text-white rounded shadow font-extrabold">
                                <span class="text-gray-500">WALLET:</span> ${{$page.auth.user.player.wallet}}
                                   <span class="text-gray-500"> WINS:</span> {{$page.auth.user.player.wins}}
                            </div>

                        </div>
                        <dropdown class="mt-1" placement="bottom-end">
                            <div class="flex items-center cursor-pointer select-none group">
                                <div class="text-grey-1000 group-hover:text-red-800 focus:text-red-900 mr-1 whitespace-no-wrap">
                                    <span>{{ $page.auth.user.first_name }}</span>
                                    <span class="hidden md:inline">{{ $page.auth.user.last_name }}</span>
                                </div>
                                <icon class="w-5 h-5 group-hover:fill-indigo-dark fill-grey-darkest focus:fill-indigo-dark" name="cheveron-down" />
                            </div>
                            <div slot="dropdown" class="mt-2 py-2 shadow-lg bg-white rounded text-sm">
                                <inertia-link class="block px-6 py-2 hover:bg-gray-800 hover:text-white" :href="route('users.edit', $page.auth.user.id)">My Profile</inertia-link>
                                <inertia-link class="block px-6 py-2 hover:bg-gray-800 hover:text-white" href="/users">Manage Users</inertia-link>
                                <inertia-link class="block px-6 py-2 hover:bg-gray-800 hover:text-white" href="/logout" method="post">Logout</inertia-link>
                            </div>
                        </dropdown>
                    </div>
                </div>
                <div class="flex flex-grow overflow-hidden">
                    <main-menu :url="url()" class="bg-gray-900 flex-no-shrink w-56 p-12 hidden md:block overflow-y-auto" />
                    <div class="w-full overflow-hidden px-4 py-8 md:p-12 overflow-y-auto" scroll-region>
                        <flash-messages></flash-messages>
                        <slot></slot>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script>
    import Dropdown from '@/Shared/Dropdown'
    import FlashMessages from '@/Shared/FlashMessages'
    import Icon from '@/Shared/Icon'
    import Logo from '@/Shared/Logo'
    import MainMenu from '@/Shared/MainMenu'

    export default {
        components: {
            Dropdown,
            FlashMessages,
            Icon,
            Logo,
            MainMenu,
        },
        data() {
            return {
                showUserMenu: false,
                accounts: null,
            }
        },
        computed:{

        },
        methods: {
            url() {
                return location.pathname.substr(1)
            },
            hideDropdownMenus() {
                this.showUserMenu = false
            }
        },
    }
</script>

