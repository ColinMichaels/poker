<template>
    <div class="bg-gray-500 text-white font-mono p-4">
        <h1 class="text-3xl text-red-500 mb-6"><i class="fa fa-exclamation-triangle"></i> {{ title }}</h1>
        <pre>{{ description }}</pre>
    </div>
</template>

<script>
    import Layout from "@/Shared/Layout";
    export default {
        props: {
            status: Number,
        },
        metaInfo:{
            title: "Server Error"
        },
        layout: Layout,
        computed: {
            title() {
                return {
                    503: '503: Service Unavailable',
                    500: '500: Server Error',
                    404: '404: Page Not Found',
                    403: '404: Forbidden',
                }[this.status]
            },
            description() {
                return {
                    503: 'Sorry, we are doing some maintenance. Please check back soon.',
                    500: 'Whoops, something went wrong on our servers.',
                    404: 'Sorry, the page you are looking for could not be found.',
                    403: 'Sorry, you are forbidden from accessing this page.',
                }[this.status]
            },
        },
    }
</script>
