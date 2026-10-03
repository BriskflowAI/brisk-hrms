<template>
	<!-- The desk's Map view, for types with a location or latitude/longitude, on the same Leaflet
	     bundle and OpenStreetMap tiles the desk uses. -->
	<section :aria-label="__('Map')" class="flex flex-col gap-2">
		<p
			v-if="error"
			role="alert"
			class="rounded-lg bg-neg-tint px-4 py-2.5 text-[13.5px] text-neg"
		>
			{{ error }}
		</p>
		<p class="text-[12.5px] text-mut">
			{{ placed }} {{ __("of") }} {{ total }} {{ __("shown on the map")
			}}<template v-if="total > placed">{{ __("; the others have no location") }}</template
			>.
		</p>
		<div
			ref="mapEl"
			class="h-[min(640px,70vh)] overflow-hidden rounded-xl border border-line bg-side"
		/>
	</section>
</template>

<script setup>
import { call } from "frappe-ui";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { titleField } from "@/composables/api";
import { loadDeskAsset } from "@/engine/compat";
import { messageOf } from "@/engine/form";

const props = defineProps({
	doctype: { type: String, required: true },
	meta: { type: Object, required: true },
	filters: { type: Array, required: true },
});
const router = useRouter();
const mapEl = ref(null);
const error = ref("");
const placed = ref(0);
const total = ref(0);
let map = null;
let layer = null;

const hasLocation = () =>
	props.meta.fields.some((f) => f.fieldname === "location" && f.fieldtype === "Geolocation");

const esc = (t) =>
	String(t ?? "").replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
	);

async function load() {
	if (!map) return;
	error.value = "";
	const title = titleField(props.meta) || "name";
	const geo = hasLocation();
	try {
		const rows =
			(await call("frappe.client.get_list", {
				doctype: props.doctype,
				fields: [
					...new Set([
						"name",
						title,
						...(geo ? ["location"] : ["latitude", "longitude"]),
					]),
				],
				filters: props.filters,
				order_by: "modified desc",
				limit_page_length: 1000,
			})) || [];
		total.value = rows.length;
		const L = window.L;
		layer?.remove();
		layer = L.featureGroup();
		for (const r of rows) {
			const label = esc(r[title] || r.name);
			const popup = `<a href="#" data-open="${esc(
				r.name,
			)}"><b>${label}</b></a><br><span style="color:#6B7083">${esc(r.name)}</span>`;
			if (geo && r.location) {
				try {
					L.geoJSON(JSON.parse(r.location)).bindPopup(popup).addTo(layer);
				} catch {
					/* unreadable location */
				}
			} else if (r.latitude && r.longitude) {
				L.marker([Number(r.latitude), Number(r.longitude)])
					.bindPopup(popup)
					.addTo(layer);
			}
		}
		placed.value = layer.getLayers().length;
		layer.addTo(map);
		if (placed.value) map.fitBounds(layer.getBounds().pad(0.2), { maxZoom: 15 });
	} catch (e) {
		error.value = messageOf(e, "Couldn't load the map.");
	}
}

function onClick(e) {
	const name = e.target.closest?.("[data-open]")?.dataset.open;
	if (!name) return;
	e.preventDefault();
	router.push({ name: "Form", params: { doctype: props.doctype, name } });
}

onMounted(async () => {
	try {
		// Leaflet as Frappe ships it. Its own files, not a desk bundle: Frappe v16 builds Leaflet
		// into the desk's libs bundle, newer Frappe into leaflet.bundle.
		await Promise.all([
			loadDeskAsset("/assets/frappe/js/lib/leaflet/leaflet.js"),
			loadDeskAsset("/assets/frappe/js/lib/leaflet/leaflet.css"),
		]);
		const L = window.L;
		L.Icon.Default.imagePath = "/assets/frappe/images/leaflet/";
		map = L.map(mapEl.value).setView([19.08, 72.8961], 3);
		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution:
				'&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
		}).addTo(map);
		mapEl.value.addEventListener("click", onClick);
		await load();
	} catch (e) {
		error.value = messageOf(e, "The map isn't available on this site.");
	}
});
onBeforeUnmount(() => {
	mapEl.value?.removeEventListener("click", onClick);
	map?.remove();
});
watch(() => JSON.stringify(props.filters), load);
</script>
