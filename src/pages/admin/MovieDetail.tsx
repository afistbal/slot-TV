import { api, upload } from "@/api";
import Forward from "@/components/Forward";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Page } from "@/layouts/admin";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/config";
import { useConfirmStore } from "@/stores/confirm";
import { CaptionsOff, ChevronsDown, ChevronsUp, Lock, Plus, Subtitles, Unlock, Video, VideoOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

interface IMovie {
    info: { [key: string]: unknown },
    episodes: { [key: string]: unknown }[],
    tag: number[],
    area: number[],
}

interface IEpisode {
    id?: number,
    file?: File,
    video?: string,
    vip: number,
    episode: number,
    subtitle?: {
        id?: number,
        file?: File,
        url?: string,
    },
}

interface IEpisodePrimitive {
    id: number,
    vip: number,
}

export default function Component() {
    const intl = useIntl();
    const params = useParams();
    const configStore = useConfigStore();
    const confirmStore = useConfirmStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLInputElement>(null);
    const episodeRef = useRef<HTMLInputElement>(null);
    const episodePrimitive = useRef<IEpisodePrimitive[]>([]);
    const [loading, setLoading] = useState(true);
    const [audioTrack, setAudioTrack] = useState('zh-Hans');
    const [episodeMore, setEpisodeMore] = useState(-1);
    const [episodeName, setEpisodeName] = useState(false);
    const [episodeValue, setEpisodeValue] = useState('');
    const [drawer, setDrawer] = useState(false);
    const [title, setTitle] = useState('');
    const [sort, setSort] = useState('');
    const [data, setData] = useState<IMovie>();
    const [episode, setEpisode] = useState<IEpisode[]>([]);
    const [image, setImage] = useState('');
    const [tagOpen, setTagOpen] = useState('');
    const [tagValue, setTagValue] = useState('');
    const [areas, setAreas] = useState<{ id: number, name: string }[]>([]);
    const [tags, setTags] = useState<{ id: number, name: string }[]>([]);
    const [areaSelected, setAreaSelected] = useState<number[]>([]);
    const [tagSelected, setTagSelected] = useState<number[]>([]);
    const [hideTag, setHideTag] = useState(true);
    const [tagSearch, setTagSearch] = useState('');

    function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTitle(e.currentTarget.value);
    }

    function handleAutoTrack(value: string) {
        setAudioTrack(value);
    }

    function handleToggleEpisodeMore() {
        setEpisodeMore(-1)
    }

    function handleToggleDrawer() {
        setDrawer(false)
    }

    // function handleUploadVideo() {

    // }

    // function handleUploadSubtitle() {

    // }

    // function handleDeleteEpisode() {
    //     episode.splice(episodeMore, 1);
    //     setEpisode([...episode]);
    //     setEpisodeMore(-1);
    // }

    function handleSetStatus(status: number) {
        confirmStore.show(() => {
            return new Promise(resolve => {
                api('admin/movie/status', {
                    method: 'post',
                    data: {
                        id: params['id'],
                        status,
                    },
                });
                if (data !== undefined) {
                    data.info['status'] = status;
                }
                setData(data ? {
                    ...data,
                } : data);
                setDrawer(false);
                resolve();
            });
        });
    }

    function handleSortChange(e: React.ChangeEvent<HTMLInputElement>) {
        setSort(e.currentTarget.value);
    }

    function handleLock() {
        episode[episodeMore].vip = episode[episodeMore].vip > 0 ? 0 : 1;
        setEpisode([...episode]);
        setEpisodeMore(-1);
    }

    // function handleSetEpisode() {
    //     setEpisodeName(true);
    // }

    function handleViewVideo() {
        const current = episode[episodeMore];
        if (!current.video && !current.file) {
            toast.warning(intl.formatMessage({ id: 'video_not_found' }));
            return;
        }
        let url = `${configStore.config['static']}/${current.video}`;
        if (!current.video) {
            url = URL.createObjectURL(new Blob(['text'], {
                type: 'text/plain'
            }));
        }

        window.open(url, 'new');
    }

    function handleViewSubtitle() {
        const current = episode[episodeMore].subtitle;
        if (!current || (!current.file && !current.url)) {
            toast.warning(intl.formatMessage({ id: 'subtitle_not_found' }));
            return;
        }
        let url = `${configStore.config['static']}/${current.url}`;
        if (!current.url) {
            url = URL.createObjectURL(new Blob(['text'], {
                type: 'text/plain'
            }));
        }

        window.open(url, 'new');
    }

    async function handleSave() {
        const changedEpisode: IEpisodePrimitive[] = [];

        episode.forEach(v => {
            if (v.vip !== episodePrimitive.current.find(vv => vv.id === v.id)?.vip) {
                changedEpisode.push({
                    id: v.id!,
                    vip: v.vip,
                });
            }
        });

        let result = await api('admin/movie/save', {
            method: 'post',
            data: {
                id: params['id'],
                episodes: changedEpisode,
                title,
                sort,
                area: areaSelected,
                tag: tagSelected,
                audio_track: audioTrack,
            },
        });

        if (result.c !== 0) {
            return;
        }

        toast.success(intl.formatMessage({ id: 'save_success' }));
    }

    // function handleBatchAddEpisode() {
    //     if (!episodeRef.current) {
    //         return;
    //     }

    //     episodeRef.current.click();
    // }

    // function handleAddEpisode() {
    //     setEpisode([...episode, { episode: episode.length === 0 ? 1 : episode[episode.length - 1].episode + 1, vip: 1 }]);
    //     setTimeout(() => {
    //         if (!scrollRef.current) {
    //             return;
    //         }
    //         scrollRef.current.scrollTo({
    //             top: scrollRef.current.scrollHeight
    //         });
    //     }, 300);
    // }

    function handleEpisodeNameToggle() {
        setEpisodeName(!episodeName);
    }

    function handleSaveEpisodeName() {
        const value = parseInt(episodeValue, 10);

        if (isNaN(value) || value <= 0) {
            toast.warning(intl.formatMessage({ id: 'episode_invalid' }));
            return;
        }
        for (let i = 0; i < episode.length; i++) {
            if (i === episodeMore) {
                continue;
            }
            if (episode[i].episode === value) {
                toast.warning(intl.formatMessage({ id: 'episode_repeated' }));
                return;
            }
        }
        episode[episodeMore].episode = value;
        episode.sort((a, b) => a.episode - b.episode);

        setEpisodeMore(episode.findIndex(v => v.episode === value));
        setEpisode([...episode]);
        setEpisodeName(!episodeName);
        setEpisodeValue('');
    }

    function handleEpisodeValueChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEpisodeValue(e.currentTarget.value);
    }

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.currentTarget.files!.item(0)!;
        setImage(URL.createObjectURL(file));

        upload(file).then(res => {
            console.log(res);
        })
    }

    function handleUploadImage() {
        if (!imageRef.current) {
            return;
        }

        // imageRef.current.click();
    }

    function handleRecommend() {
        confirmStore.show(async function () {
            const nowSort = data!.info['sort'] === 0 ? 100 : 0;
            const res = await api('admin/movie/sort', {
                method: 'post',
                data: {
                    id: data!.info['id'],
                    sort: nowSort,
                },
            });
            if (res.c !== 0) {
                return;
            }
            setDrawer(false);
            setData({
                ...data!,
                info: {
                    ...data!.info,
                    sort: nowSort,
                },
            });
            toast.success(intl.formatMessage({ id: 'success' }));
        })
    }

    function handleOpenAddTag(name: string) {
        setTagOpen(name);
    }

    function handleTagValueChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTagValue(e.currentTarget.value);
    }

    async function handleSaveTag() {
        const value = tagValue.trim();
        if (!/^[a-zA-Z0-9_\-]{1,24}$/.test(value)) {
            toast.warning(intl.formatMessage({ id: 'tag_illegal' }));
            return;
        }
        if (tagOpen === 'area' && areas.filter(v => v.name === value).length === 0) {
            const result = await api<number>('admin/area', {
                method: 'post',
                data: {
                    name: value,
                }
            });
            setAreas([...areas, { id: result.d, name: value }]);

        } else if (tagOpen === 'tag' && tags.filter(v => v.name === value).length === 0) {
            const result = await api<number>('admin/tag', {
                method: 'post',
                data: {
                    name: value,
                }
            });
            setTags([...tags, { id: result.d, name: value }]);

        }
        setTagOpen('');
        setTagValue('');
    }

    function handleAreaChange(id: number) {
        if (areaSelected.indexOf(id) === -1) {
            setAreaSelected([...areaSelected, id]);
        } else {
            setAreaSelected(areaSelected.filter(v => v !== id));
        }
    }

    function handleTagChange(id: number) {
        if (tagSelected.indexOf(id) === -1) {
            setTagSelected([...tagSelected, id]);
        } else {
            setTagSelected(tagSelected.filter(v => v !== id));
        }
    }

    function handleTagSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTagSearch(e.currentTarget.value);
    }

    function handleExport() {
        api<string>('admin/movie/export', {
            data: {
                id: params['id'],
            },
        }).then(res => {
            const url = URL.createObjectURL(new Blob([res.d], {
                type: 'text/plain; charset=utf-8',
            }));
            const a = document.createElement('a');
            a.href = url;
            a.download = params['id'] + '.txt';
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    async function loadData() {
        if (!params['id']) {
            setLoading(false);
            return;
        }

        const result = await api<IMovie>('admin/movie', {
            data: {
                id: params['id'],
            },
            loading: false,
        });

        if (result.c !== 0) {
            setLoading(false);
            return;
        }

        const tag = await api<{ id: number, name: string }[]>('admin/tag', {
            loading: false,
        });

        const area = await api<{ id: number, name: string }[]>('admin/area', {
            loading: false,
        });

        setTags(tag.d);
        setAreas(area.d);
        setTagSelected(result.d.tag);
        setAreaSelected(result.d.area);

        setTitle(result.d.info['title'] as string);
        setSort(result.d.info['sort'] as string);
        setAudioTrack(result.d.info['audio_track'] === null ? 'zh-Hans' : result.d.info['audio_track'] as string);
        setData(result.d);
        setEpisode(result.d.episodes.map(v => {
            const tmp = v['subtitle'] as { [key: string]: unknown };
            return {
                id: v.id as number,
                video: v.video as string,
                vip: v.vip as number,
                episode: v.episode as number,
                subtitle: tmp && {
                    id: tmp['id'] as number,
                    url: tmp['url'] as string,
                }
            };
        }));
        episodePrimitive.current = result.d.episodes.map(v => ({ id: v.id as number, vip: v.vip as number }));
        setImage(result.d.info['image'] as string);

        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    const episodes = useMemo(() => {
        return episode.map((v, k) =>
            <div key={v.episode} className="flex gap-4 justify-between items-center p-4 leading-4 border border-slate-300 bg-slate-50 rounded-sm" onClick={() => setEpisodeMore(k)}>
                <div className="font-bold w-full overflow-hidden whitespace-nowrap text-ellipsis text-slate-700">{`${v.episode.toString().padStart(3, '0')}`}</div>
                <div className="flex gap-2 items-center">
                    {!v.file && !v.video ? <VideoOff className="w-5 h-5 text-red-400" /> : <Video className="w-5 h-5 text-slate-400" />}
                    {!v.subtitle || (!v.subtitle.file && !v.subtitle.url) ? <CaptionsOff className="w-5 h-5 text-red-400" /> : <Subtitles className="w-5 h-5 text-slate-400" />}
                    {v.vip > 0 ? <Lock className="w-5 h-5 text-amber-400" /> : <Unlock className="w-5 h-5 text-slate-300" />}
                </div>
            </div>);
    }, [episode]);

    return <Page title={params['id'] === undefined ? 'flix_add' : 'flix_edit'} menuButton={<div className="px-4 text-lg" onClick={handleSave}>Save</div>}>
        {loading ? <div className="h-[calc(100%-theme(spacing.16))] flex justify-center items-center">
            <Loader />
        </div> : <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto" ref={scrollRef}>
            {data !== undefined && <div className="flex flex-col gap-2">
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="flix_operation" />
                </div>
                <div className="flex flex-col border rounded-sm bg-slate-50 text-slate-500">
                    <Link to={`/video/${data.info['id']}`} className="flex h-14 px-4 justify-between items-center border-b">
                        <div>
                            <FormattedMessage id="play" />
                        </div>
                        <div><Forward /></div>
                    </Link>
                    <div className="flex h-14 px-4 justify-between items-center border-b" onClick={handleExport}>
                        <div>
                            <FormattedMessage id="export" />
                        </div>
                        <div><Forward /></div>
                    </div>
                    <div className="flex h-14 px-4 justify-between items-center" onClick={() => setDrawer(true)}>
                        <div>
                            <FormattedMessage id="more" />
                        </div>
                        <div><Forward /></div>
                    </div>
                </div>
            </div>}
            {data !== undefined && <div className="flex flex-col gap-2">
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="flix_status" />
                </div>
                <div>
                    <FormattedMessage id={data.info['status'] === 1 ? 'movie_active' : data.info['status'] === 2 ? 'movie_inactive' : data.info['status'] === 3 ? 'movie_deleted' : 'none'} />
                </div>
            </div>}
            {data !== undefined && <div className="flex flex-col gap-2">
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="created_at" />
                </div>
                <div>
                    {data?.info['created_at'] ? <FormattedDate
                        year="numeric"
                        month="2-digit"
                        day="2-digit"
                        hour="2-digit"
                        minute="2-digit"
                        second="2-digit"
                        value={data?.info['created_at'] as string}
                    /> : '...'}
                </div>
            </div>}
            {data !== undefined && <div className="flex flex-col gap-2">
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="updated_at" />
                </div>
                <div>
                    {data?.info['updated_at'] ? <FormattedDate
                        year="numeric"
                        month="2-digit"
                        day="2-digit"
                        hour="2-digit"
                        minute="2-digit"
                        second="2-digit"
                        value={data?.info['updated_at'] as string}
                    /> : '...'}
                </div>
            </div>}
            {data !== undefined && <div className='flex flex-col gap-2'>
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="flix_sort" />
                </div>
                <input value={sort} onChange={handleSortChange} className='focus:bg-slate-100 focus:border-slate-400 bg-slate-50 w-full leading-4 p-4 rounded-sm m-0 outline-none border border-slate-300 text-md placeholder:leading-4 placeholder:text-md placeholder-gray-400' placeholder={intl.formatMessage({ id: 'flix_sort_placeholder' })} />
            </div>}
            <div className='flex flex-col gap-2'>
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="audio_track" />
                </div>
                <RadioGroup value={audioTrack} className='flex space-x-2 mt-2' onValueChange={handleAutoTrack}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="zh-Hans" id="option-one" />
                        <Label htmlFor="option-one">zh-Hans</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="en" id="option-two" />
                        <Label htmlFor="option-two">en</Label>
                    </div>
                </RadioGroup>
            </div>
            <div className="flex flex-col gap-2">
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="area" /> ({areaSelected.length})
                </div>
                <div className="flex flex-wrap gap-2">
                    {areas.map(v => <Label key={v.id} className="flex items-center gap-2 border rounded-sm px-2 py-2 bg-white text-slate-500 text-sm">
                        <Checkbox checked={areaSelected.indexOf(v.id) !== -1} onCheckedChange={() => handleAreaChange(v.id)} />
                        {v.name}
                    </Label>)}
                    <div className="flex items-center gap-1 border rounded-sm px-2 py-2 bg-white text-lime-600 text-sm" onClick={() => handleOpenAddTag('area')}>
                        <Plus className="w-4 h-4" />
                        <FormattedMessage id="add_area" />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="tag" /> ({tagSelected.length})
                </div>
                <div className="flex gap-2">
                    <div className="flex-1"><input value={tagSearch} onChange={handleTagSearchChange} placeholder={intl.formatMessage({ id: 'search' })} className="h-10 focus:bg-slate-100 focus:border-slate-400 bg-slate-50 w-full leading-4 p-2 rounded-sm m-0 outline-none border border-slate-300 text-md placeholder:leading-4 placeholder:text-md placeholder-gray-400" /></div>
                    <div className="border-slate-300 border rounded-sm bg-slate-100 w-10 flex justify-center items-center" onClick={() => setHideTag(!hideTag)}>
                        {hideTag ? <ChevronsDown className="w-5 h-5 text-slate-500" /> : <ChevronsUp className="w-5 h-5 text-slate-500" />}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {tags.filter(v => v.name.search(new RegExp(tagSearch.trim(), 'i')) !== -1).map((v, k) => <Label key={v.id} className={cn('flex items-center gap-2 border rounded-sm px-2 py-2 bg-white text-slate-500 text-sm', (k > 10 && hideTag) && 'hidden')}>
                        <Checkbox checked={tagSelected.indexOf(v.id) !== -1} onCheckedChange={() => handleTagChange(v.id)} />
                        {v.name}
                    </Label>)}
                    <div className="flex items-center gap-1 border rounded-sm px-2 py-2 bg-white text-indigo-600 text-sm" onClick={() => handleOpenAddTag('tag')}>
                        <Plus className="w-4 h-4" />
                        <FormattedMessage id="add_tag" />
                    </div>
                </div>
            </div>
            <div className='flex flex-col gap-2'>
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="flix_title" />
                </div>
                <input value={title} onChange={handleTitleChange} className='focus:bg-slate-100 focus:border-slate-400 bg-slate-50 w-full leading-4 p-4 rounded-sm m-0 outline-none border border-slate-300 text-md placeholder:leading-4 placeholder:text-md placeholder-gray-400' placeholder={intl.formatMessage({ id: 'flix_title_placeholder' })} />
            </div>
            <div className='flex flex-col gap-2'>
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="flix_image" />
                </div>
                <div className="flex flex-wrap gap-4">
                    <div className="border border-slate-300 rounded-sm flex justify-center items-center bg-slate-50 overflow-hidden p-1" onClick={handleUploadImage}>
                        {data ? <img src={image.startsWith('blob:') ? image : `${configStore.config['static']}/${image}`} className="h-16" /> : <Plus className="text-slate-500 w-8 h-8 m-4 stroke-1" />}
                    </div>
                </div>
                <input type="file" className="hidden" onChange={handleImageChange} ref={imageRef} />
            </div>
            <div className='flex flex-col gap-2'>
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="flix_episodes" />
                </div>
                <div className="flex justify-between items-center p-4 border border-slate-300 rounded-sm bg-black/5 text-slate-400 mb-2">
                    <div>
                        <FormattedMessage id="flix_episodes_info" values={{
                            episodes: episode.length,
                            videos: episode.filter(v => v.video !== undefined || v.file !== undefined).length,
                            subtitles: episode.filter(v => v.subtitle !== undefined && v.subtitle !== null && (v.subtitle.file !== undefined || v.subtitle.url !== undefined)).length,
                        }} />
                    </div>
                </div>
                {/* <div className="mb-2 flex gap-4">
                    <Button className="flex-1 bg-linear-to-r text-sm from-pink-400 to-purple-400 text-white font-bold" onClick={handleBatchAddEpisode}>
                        <ListPlus className="size-5 shrink-0" />
                        <FormattedMessage id="batch_add_episode" />
                    </Button>
                    <Button className="flex-1 bg-linear-to-r text-sm from-green-400 to-cyan-400 text-white font-bold" onClick={handleAddEpisode}>
                        <Plus className="size-5 shrink-0" />
                        <FormattedMessage id="add_episode" />
                    </Button>
                </div> */}
                <div className="grid grid-cols-2 gap-4">
                    {episodes}
                </div>
                {/* @ts-ignore */}
                <input type="file" className="hidden" webkitdirectory="" ref={episodeRef} />
            </div>
        </div>}
        <Drawer open={episodeMore > -1} onOpenChange={handleToggleEpisodeMore}>
            <DrawerContent className="bg-linear-to-b from-yellow-100 to-white" aria-describedby="episode">
                <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                    <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                        <FormattedMessage id="episode_number" values={{
                            number: episodeMore > -1 ? episode[episodeMore].episode : '',
                        }} />
                    </div>
                    <div onClick={() => handleToggleEpisodeMore()}>
                        <X />
                    </div>
                </DrawerTitle>
                <div className="flex flex-col p-4 pb-12 gap-4">
                    <div className="flex gap-4">
                        <Button className="bg-red-400 flex-1" onClick={handleViewVideo}>
                            1.<FormattedMessage id="flix_video_play" />
                        </Button>
                        <Button className="bg-emerald-400 flex-1" onClick={handleViewSubtitle}>
                            2.<FormattedMessage id="flix_subtitle_view" />
                        </Button>
                    </div>
                    <div className="flex gap-4">
                        <Button className="bg-amber-400 flex-1" onClick={handleLock}>
                            3.<FormattedMessage id="flix_lock" />
                        </Button>
                        {/* <Button className="bg-indigo-400 flex-1" onClick={handleSetEpisode}>
                            4.<FormattedMessage id="flix_set_episode" />
                        </Button> */}
                    </div>
                    {/* <div className="flex gap-4">
                        <Button className="bg-indigo-400 flex-1" onClick={handleUploadVideo}>
                            5.<FormattedMessage id="flix_upload_video" />
                        </Button>
                        <Button className="bg-indigo-400 flex-1" onClick={handleUploadSubtitle}>
                            6.<FormattedMessage id="flix_upload_subtitle" />
                        </Button>
                    </div> */}
                    <hr />
                    {/* <Button onClick={handleDeleteEpisode}>
                        <FormattedMessage id="delete" />
                    </Button> */}
                    <Button className="bg-slate-400" onClick={handleToggleEpisodeMore}>
                        <FormattedMessage id="cancel" />
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
        <Drawer open={drawer} onOpenChange={handleToggleDrawer}>
            <DrawerContent className="bg-linear-to-b from-yellow-100 to-white" aria-describedby="manage">
                <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                    <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                        <FormattedMessage id="flix_manage" />
                    </div>
                    <div onClick={handleToggleDrawer}>
                        <X />
                    </div>
                </DrawerTitle>
                <div className="flex flex-col p-4 pb-12 gap-4">
                    <Button className="bg-purple-400" onClick={() => handleRecommend()}>
                        <FormattedMessage id="recommend" />
                    </Button>
                    <Button onClick={() => handleSetStatus(1)} className="bg-green-400">
                        <FormattedMessage id="movie_enable" />
                    </Button>
                    <Button onClick={() => handleSetStatus(2)} className="bg-amber-400">
                        <FormattedMessage id="movie_disable" />
                    </Button>
                    <Button onClick={() => handleSetStatus(3)}>
                        <FormattedMessage id="movie_delete" />
                    </Button>
                    <Button className="bg-slate-400" onClick={handleToggleDrawer}>
                        <FormattedMessage id="cancel" />
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
        <Dialog open={episodeName} onOpenChange={handleEpisodeNameToggle}>
            <DialogContent>
                <DialogTitle>
                    <FormattedMessage id="flix_set_episode" />
                </DialogTitle>
                <DialogDescription>
                    <FormattedMessage id="set_episode_description" values={{
                        episode: episodeMore > -1 ? episode[episodeMore].episode : '',
                    }} />
                </DialogDescription>
                <div className="my-4">
                    <input value={episodeValue} onChange={handleEpisodeValueChange} type="number" autoFocus className="p-4 border border-slate-200 rounded-md w-full" placeholder={intl.formatMessage({ id: 'placeholder_episode_episode' })} />
                </div>
                <DialogFooter>
                    <div className="flex gap-4">
                        <Button className="flex-1" onClick={handleSaveEpisodeName}>
                            <FormattedMessage id="ok" />
                        </Button>
                        <Button className="flex-1 bg-slate-400" onClick={handleEpisodeNameToggle}>
                            <FormattedMessage id="cancel" />
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={tagOpen != ''} onOpenChange={() => handleOpenAddTag('')}>
            <DialogContent>
                <DialogTitle>
                    {tagOpen && <FormattedMessage id={`add_${tagOpen}`} />}
                </DialogTitle>
                <DialogDescription>
                    {tagOpen && <FormattedMessage id={`add_${tagOpen}_desc`} />}
                </DialogDescription>
                <div className="my-4">
                    <input value={tagValue} onChange={handleTagValueChange} type="text" autoFocus className="p-4 border border-slate-200 rounded-md w-full" placeholder={tagOpen === '' ? '' : intl.formatMessage({ id: `${tagOpen}_placeholder` })} />
                </div>
                <DialogFooter>
                    <div className="flex gap-4">
                        <Button className="flex-1" onClick={handleSaveTag}>
                            <FormattedMessage id="ok" />
                        </Button>
                        <Button className="flex-1 bg-slate-400" onClick={() => handleOpenAddTag('')}>
                            <FormattedMessage id="cancel" />
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Page>
}